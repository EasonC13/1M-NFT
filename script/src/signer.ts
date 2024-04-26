import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import {
  SuiClient,
  SuiTransactionBlockResponse,
  SuiTransactionBlockResponseOptions,
} from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { SignatureWithBytes } from "@mysten/sui.js/cryptography";

export class Signer {
  private suiKeypair: Ed25519Keypair;
  public suiClient: SuiClient;

  constructor(inputs: { keyPhrase: string; suiClient: SuiClient }) {
    this.suiClient = inputs.suiClient;
    this.suiKeypair = Ed25519Keypair.deriveKeypair(inputs.keyPhrase);
  }

  getSuiAddress(): string {
    return this.suiKeypair.getPublicKey().toSuiAddress();
  }

  async signAndExecuteTransactionBlock(txInput: {
    transactionBlock: TransactionBlock;
    options?: SuiTransactionBlockResponseOptions;
  }): Promise<SuiTransactionBlockResponse> {
    return this.suiClient.signAndExecuteTransactionBlock({
      transactionBlock: txInput.transactionBlock,
      signer: this.suiKeypair,
      options: txInput.options,
    });
  }

  async signTransactionBlock(txInput: {
    transactionBlockBytes: Uint8Array;
  }): Promise<SignatureWithBytes> {
    return this.suiKeypair.signTransactionBlock(txInput.transactionBlockBytes);
  }
}
