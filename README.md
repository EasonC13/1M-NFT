# How to run?

## 0. Publish this module to Sui

```
sui client publish . --gas-budget 7500000000 --skip-dependency-verification --skip-fetch-latest-git-deps --silence-warnings
```

## 1. Go to the scripts and install Dependencies

```
cd scripts
npm i
```

## 2. Set up the .env

```
cp .env.example .env
```

Then change the variable accordingly.

The PACKAGE_ID will be the one you published.

You should specify the RPC URL to prevent timeout.

Enter seed phrase of your Sui wallet that have enough funding. (Need to prepare 4k Sui just in case, but 2k will be enough and you may need to modify the `scripts/src/mint.ts`)

## 3. Prepare gas

```
npm run prepare
```


## 4. Mint 1M NFT

```
npm run mint
```