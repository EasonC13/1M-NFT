import { TransactionBlock } from "@mysten/sui.js/transactions";
import { Signer } from "./signer";
import { config } from "dotenv";
import { SuiClient, SuiObjectRef, getFullnodeUrl } from "@mysten/sui.js/client";

config();

export async function main() {
  const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
  const SUI = "0x2::sui::SUI";
  const signer = new Signer({
    keyPhrase: process.env.PRIVATE_SEED || "",
    suiClient,
  });
  const packageId = process.env.PACKAGE_ID || "";

  const senderAddress = signer.getSuiAddress();
  // get all supply managers

  const package_object = await suiClient.getObject({
    id: packageId,
  });
  const packageDeploymentBlock = suiClient.getTransactionBlock({
    digest: package_object.data?.digest || "",
  });
  console.log(packageDeploymentBlock);

  //   const userCoins = await suiClient.getCoins({
  //     owner: senderAddress,
  //   });

  //   const txb = new TransactionBlock();
  //   let coinInput = txb.splitCoins(txb.gas, [txb.pure(2000, "u64")]);
  //   txb.moveCall({
  //     target: `${packageId}::mnft::split_gas_coins`,
  //     typeArguments: [SUI],
  //     arguments: [txb.object(coinInput), txb.pure(1000, "u64")],
  //   });

  //   const tx = await signer.signAndExecuteTransactionBlock({
  //     transactionBlock: txb,
  //     options: {
  //       showObjectChanges: true,
  //     },
  //   });

  //   if (!tx.objectChanges) {
  //     return;
  //   }
  //   const gasCoins: SuiObjectRef[] = [];
  //   tx.objectChanges.forEach((change) => {
  //     if (change.type == "created" && change.objectType == SUI) {
  //       gasCoins.push({
  //         objectId: change.objectId,
  //         digest: change.digest,
  //         version: change.version,
  //       });
  //     }
  //   });

  //   await suiClient.waitForTransactionBlock({
  //     digest: tx.digest,
  //   });

  //   const promises = [];
  //   gasCoins.forEach((coinInput) => {
  //     const txb = new TransactionBlock();
  //     txb.setGasPayment([coinInput]);
  //     txb.moveCall({
  //       target: `${packageId}::mnft::batch_mint_to`,
  //       typeArguments: [SUI],
  //       arguments: [
  //         txb.object(),
  //         txb.pure(
  //           "0xd71bceb881f839dd871b6d655ceec19a3332f6b30535ccd5a53bbb2c907f9003",
  //           "address"
  //         ),
  //         txb.pure(1000, "u64"),
  //       ],
  //     });
  //   });
}

main();
