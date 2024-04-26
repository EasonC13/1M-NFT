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

    console.log("supplyManagers.length", supplyManagers.length);

    const userCoins: string[] = [];
    const userCoinsObjectRef: SuiObjectRef[] = [];

    {
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
          return coin.coinObjectId;
        });
        userCoins.push(...gasCoin_s);

        const gasCoin_ss = result.data.map((coin) => {
          return {
            objectId: coin.coinObjectId,
            digest: coin.digest,
            version: coin.version,
          };
        });
        userCoinsObjectRef.push(...gasCoin_ss);
      }
    }
    console.log("Merging Gas Coins to reset the state");
    const coin_chunk = 100;
    try {
      for (let i = 0; i < userCoins.length / coin_chunk; i++) {
        console.log(`${i + 1}/${Math.ceil(userCoins.length / coin_chunk)}`);
        const txb = new TransactionBlock();
        txb.setGasPayment([userCoinsObjectRef[0]]);

        txb.mergeCoins(txb.gas, [
          ...userCoins.slice(
            1 + i * coin_chunk,
            1 + i * coin_chunk + coin_chunk
          ),
        ]);
        const block = await signer.signAndExecuteTransactionBlock({
          transactionBlock: txb,
          options: {
            showObjectChanges: true,
          },
        });
        await suiClient.waitForTransactionBlock({
          digest: block.digest,
        });
        const object = await suiClient.getObject({
          id: userCoins[0],
        });
        userCoinsObjectRef[0] = {
          objectId: userCoins[0],
          digest: object.data?.digest || "",
          version: object.data?.version || "",
        };
        // show like 1/20 2/20 3/20
      }
    } catch (e) {}

    for (let i = 0; i < supplyManagers.length / coin_chunk; i++) {
      const txb = new TransactionBlock();
      txb.setGasPayment([userCoinsObjectRef[0]]);

      for (let j = 0; j < coin_chunk; j++) {
        const coin = txb.splitCoins(txb.gas, [txb.pure(3 * 10 ** 9, "u64")]);
        txb.transferObjects([coin], senderAddress);
      }

      const block = await signer.signAndExecuteTransactionBlock({
        transactionBlock: txb,
        options: {
          showObjectChanges: true,
        },
      });
      await suiClient.waitForTransactionBlock({
        digest: block.digest,
      });
      const object = await suiClient.getObject({
        id: userCoins[0],
      });
      userCoinsObjectRef[0] = {
        objectId: userCoins[0],
        digest: object.data?.digest || "",
        version: object.data?.version || "",
      };
      // show like 1/20 2/20 3/20
      console.log(
        `Splitting gas coins ${i + 1}/${Math.ceil(
          supplyManagers.length / coin_chunk
        )}`
      );
    }
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

    console.log("gasCoins", gasCoins.length);
    console.log("supplyManagers", supplyManagers.length);
  } catch (e) {
    console.error(e);
  }
}

main().then(() => {
  console.log("Main finish");
});
