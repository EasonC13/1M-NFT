import {
  TransactionBlock,
  TransactionObjectInput,
} from "@mysten/sui.js/transactions";
import { Signer } from "./signer";
import { config } from "dotenv";
import { SuiClient, SuiObjectRef, getFullnodeUrl } from "@mysten/sui.js/client";

config();

export async function main() {
  try {
    const suiClient = new SuiClient({
      url: process.env.SUI_ENDPOINT_TESTNET as any,
    });
    const SUI = "0x2::sui::SUI";
    const signer = new Signer({
      keyPhrase: process.env.PRIVATE_SEED || "",
      suiClient,
    });
    const packageId = process.env.PACKAGE_ID || "";
    const chunk = 1;

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

    console.log("=== Ends of preparation ===");

    const promises = [];
    console.log("gasCoins.length", gasCoins.length);
    console.log("supplyManagers.length", supplyManagers.length);
    if (gasCoins.length < supplyManagers.length) {
      throw new Error(
        "Not enough gas coins for supply managers. Please run the ./prepare.ts script first."
      );
    }
    console.log("Start!");
    const time = Date.now();
    let total_minted = 0;
    let total_minted_by_counting_created_objects = 0;

    for (let index = 0; index < supplyManagers.length; index++) {
      let coinInput = gasCoins[index];
      const supplyManagerInput = supplyManagers[index];
      const managerIndex = index;

      promises.push(
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
                txb.moveCall({
                  target: `${packageId}::mnft::batch_mint_to`,
                  arguments: [
                    txb.object(supplyManagerInput),
                    txb.pure(1000_000 / supplyManagers.length / chunk, "u64"),
                    txb.pure(
                      "0x3d1037246147d652b463ff8815acaf034091d21bf2cfa996fab41d36c96ba099",
                      "address"
                    ),
                  ],
                });

                const block = await signer.signAndExecuteTransactionBlock({
                  transactionBlock: txb,
                  options: {
                    showObjectChanges: true,
                  },
                }); //update the gas coin input
                total_minted += 1000_000 / supplyManagers.length / chunk;
                block.objectChanges?.forEach((change) => {
                  if (change.type == "mutated" && change.objectType == SUI) {
                    coinInput = {
                      objectId: change.objectId,
                      digest: change.digest,
                      version: change.version,
                    };
                  }
                });

                total_minted_by_counting_created_objects +=
                  block.objectChanges?.filter((change: any) => {
                    return (
                      change.type == "created" &&
                      change.objectType == `${packageId}::mnft::M_NFT`
                    );
                  }).length || 0;
                // await suiClient.waitForTransactionBlock({
                //   digest: block.digest,
                // });
                i++;
              } catch (e) {
                // console.log("Error", e);
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

    for (const promise of promises) {
      await promise;
    }
    console.log({ total_minted, total_minted_by_counting_created_objects });
    const now = Date.now();
    console.log(
      "Time taken",
      (now - time) / 1000,
      "seconds for the minting process."
    );
  } catch (e) {
    console.log(e);
  }
}

main().then(() => {
  console.log("Main finish");
});
