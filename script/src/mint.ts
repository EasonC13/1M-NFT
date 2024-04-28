import {
  TransactionBlock,
  TransactionObjectInput,
} from "@mysten/sui.js/transactions";
import { Signer } from "./signer";
import { config } from "dotenv";
import { SuiClient, SuiObjectRef, getFullnodeUrl } from "@mysten/sui.js/client";
import { SignatureWithBytes } from "@mysten/sui.js/dist/cjs/cryptography";

config();

function writeToJsonFile(data: any, filename: string) {
  const fs = require("fs");
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

export async function main() {
  try {
    const suiClient = new SuiClient({
      url: process.env.SUI_ENDPOINT_DEVNET as any,
    });
    const SUI = "0x2::sui::SUI";
    const signer = new Signer({
      keyPhrase: process.env.PRIVATE_SEED || "",
      suiClient,
    });
    const packageId = process.env.PACKAGE_ID || "";
    const chunk = 1;
    const total_nft_count = 1000_000;

    const senderAddress = signer.getSuiAddress();

    // get all supply managers
    console.log("Prepare Gas Coins");

    const package_object = await suiClient.getObject({
      id: packageId,
      options: {
        showPreviousTransaction: true,
      },
    });

    const packageDeploymentBlock = await suiClient.getTransactionBlock({
      digest: package_object.data?.previousTransaction || "",
      options: {
        showObjectChanges: true,
      },
    });

    const supplyManagers: TransactionObjectInput[] = [];
    packageDeploymentBlock.objectChanges?.forEach((change) => {
      if (
        change.type == "created" &&
        change.objectType == `${packageId}::mnft::SupplyManager`
      ) {
        supplyManagers.push(change.objectId);
      }
    });

    const gasCoins: SuiObjectRef[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;
    while (hasNextPage) {
      const result = await suiClient.getCoins({
        owner: senderAddress,
        limit: 600,
        cursor,
      });

      hasNextPage = result.hasNextPage;
      cursor = result.nextCursor || null;
      const gasCoin_s = result.data.map((coin) => {
        return {
          objectId: coin.coinObjectId,
          digest: coin.digest,
          version: coin.version,
        };
      });
      gasCoins.push(...gasCoin_s);
    }

    const createMintTxPromises = [];
    console.log("gasCoins.length", gasCoins.length);
    console.log("supplyManagers.length", supplyManagers.length);
    if (gasCoins.length < supplyManagers.length) {
      throw new Error(
        "Not enough gas coins for supply managers. Please run the ./prepare.ts script first."
      );
    }

    console.log("Start Preparing Minting Transactions!");

    const ListOfSignatureWithBytes: SignatureWithBytes[] = [];

    for (let index = 0; index < supplyManagers.length; index++) {
      let coinInput = gasCoins[index];
      const supplyManagerInput = supplyManagers[index];
      const managerIndex = index;

      createMintTxPromises.push(
        (async () => {
          try {
            let i = 0;
            while (i < chunk) {
              // console.log(
              //   `Processing chunk ${i + 1} for manager ${managerIndex}`
              // );
              try {
                const txb = new TransactionBlock();
                txb.setGasPayment([coinInput]);
                txb.setSender(senderAddress);
                txb.moveCall({
                  target: `${packageId}::mnft::batch_mint_to`,
                  arguments: [
                    txb.object(supplyManagerInput),
                    txb.pure(
                      total_nft_count / supplyManagers.length / chunk,
                      "u64"
                    ),
                    txb.pure(
                      "0x3d1037246147d652b463ff8815acaf034091d21bf2cfa996fab41d36c96ba099",
                      "address"
                    ),
                  ],
                });

                const signatureWithBytes = await signer.signTransactionBlock({
                  transactionBlockBytes: await txb.build({ client: suiClient }),
                });
                ListOfSignatureWithBytes.push(signatureWithBytes);

                i++;
              } catch (e: any) {
                if (!e.message.includes("fetch failed")) {
                  console.log("Error", e);
                }
                continue;
              }
              // console.log(
              //   `Transaction completed for chunk ${
              //     i + 1
              //   } and manager ${managerIndex}`
              // );
            }
          } catch (error) {
            console.error(
              `Error in processing for manager ${managerIndex}:`,
              error
            );
          }
        })()
      );
    }

    await Promise.all(createMintTxPromises);

    console.log(
      "Finish creating minting transaction promises, now awaiting the creation promises for sending transactions."
    );

    let total_minted = 0;
    let total_minted_by_counting_created_objects = 0;
    const minted_nfts: TransactionObjectInput[] = [];

    const SendTxPromises = [];
    for (let index = 0; index < ListOfSignatureWithBytes.length; index++) {
      let signatureWithBytes = ListOfSignatureWithBytes[index];
      SendTxPromises.push(
        (async () => {
          while (1) {
            try {
              const block = await suiClient.executeTransactionBlock({
                transactionBlock: signatureWithBytes.bytes,
                signature: signatureWithBytes.signature,
                options: {
                  showObjectChanges: true,
                },
              });

              total_minted += total_nft_count / supplyManagers.length / chunk;
              total_minted_by_counting_created_objects +=
                block.objectChanges?.filter(
                  (change) =>
                    change.type == "created" &&
                    change.objectType == `${packageId}::mnft::M_NFT`
                ).length || 0;

              const minted_nfts =
                block.objectChanges
                  ?.filter((change: any) => {
                    return (
                      change.type == "created" &&
                      change.objectType == `${packageId}::mnft::M_NFT`
                    );
                  })
                  .map((change: any) => {
                    return {
                      objectId: change.objectId as string,
                      digest: change.digest as string,
                      version: change.version as string,
                    };
                  }) || [];

              const newGasCoin: any = block.objectChanges?.filter(
                (change) =>
                  change.type == "mutated" && change.objectType.includes(SUI)
              )[0];
              if (newGasCoin) {
                gasCoins[index].version = newGasCoin.version;
                gasCoins[index].digest = newGasCoin.digest;
              }

              minted_nfts.concat(minted_nfts);

              break;
            } catch (e: any) {
              if (!e.message.includes("fetch failed")) {
                console.log("Error", e);
              }
              continue;
            }
          }
        })()
      );
    }

    console.log("=== Ends of preparation ===");
    console.log("Start Minting!");
    const time = Date.now();

    await Promise.all(SendTxPromises);

    console.log({ total_minted, total_minted_by_counting_created_objects });
    const now = Date.now();
    console.log(
      `
      Time taken for the minting process: ${
        (now - time) / 1000
      } seconds for minting ${total_minted_by_counting_created_objects} NFTs.`
    );

    const MintingSpeed = {
      minting_speed:
        total_minted_by_counting_created_objects / ((now - time) / 1000),
      total_minted: total_minted_by_counting_created_objects,
      total_time: (now - time) / 1000,
    };
    writeToJsonFile(MintingSpeed, "minting_speed.json");

    writeToJsonFile(minted_nfts, "minted_nfts.json");

    console.log("");
    console.log("Start Preparing Burning Transactions!");

    const createBurnTxPromises = [];
    const burnTxSignatureWithBytes: any[] = [];

    const burn_chunk = 10;

    for (let index = 0; index < supplyManagers.length; index++) {
      const coinInput = gasCoins[index];
      let target_nfts = minted_nfts.slice(
        index * burn_chunk,
        index * burn_chunk + burn_chunk
      );
      createBurnTxPromises.push(
        (async () => {
          try {
            const txb = new TransactionBlock();
            txb.setSender(senderAddress);
            txb.setGasPayment([coinInput]);
            for (let target_nft of target_nfts) {
              txb.moveCall({
                target: `${packageId}::mnft::burn_nft`,
                arguments: [txb.object(target_nft)],
              });
            }

            while (1) {
              try {
                const signatureWithBytes = await signer.signTransactionBlock({
                  transactionBlockBytes: await txb.build({ client: suiClient }),
                });
                burnTxSignatureWithBytes.push(signatureWithBytes);
                break;
              } catch (e: any) {
                if (!e.message.includes("fetch failed")) {
                  console.log("Error", e);
                }
                continue;
              }
            }
          } catch (error) {
            console.error("Error in processing:", error);
          }
        })()
      );
    }

    await Promise.all(createBurnTxPromises);

    console.log("=== Ends of preparation ===");

    console.log("Start Burning!");

    const burnTime = Date.now();
    let totalBurned = 0;

    const burnTxPromises = [];
    for (let index = 0; index < burnTxSignatureWithBytes.length; index++) {
      let signatureWithBytes = burnTxSignatureWithBytes[index];
      burnTxPromises.push(
        (async () => {
          while (1) {
            try {
              const block = await suiClient.executeTransactionBlock({
                transactionBlock: signatureWithBytes.bytes,
                signature: signatureWithBytes.signature,
                options: {
                  showObjectChanges: true,
                },
              });
              totalBurned +=
                block.objectChanges?.filter(
                  (change) =>
                    change.type == "deleted" &&
                    change.objectType == `${packageId}::mnft::M_NFT`
                ).length || 0;
              break;
            } catch (e: any) {
              if (!e.message.includes("fetch failed")) {
                console.log("Error", e);
              }
              continue;
            }
          }
        })()
      );
    }

    await Promise.all(burnTxPromises);

    console.log({ totalBurned });
    const burnNow = Date.now();
    console.log(
      `
      Time taken for the burning process: ${
        (burnNow - burnTime) / 1000
      } seconds for burning ${totalBurned} NFTs.`
    );

    const BurningSpeed = {
      burning_speed: totalBurned / ((burnNow - burnTime) / 1000),
      total_burned: totalBurned,
      total_time: (burnNow - burnTime) / 1000,
    };
    writeToJsonFile(BurningSpeed, "burning_speed.json");
  } catch (e) {
    console.log(e);
  }
}

main().then(() => {
  console.log("Main finish");
});
