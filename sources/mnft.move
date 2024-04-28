/// Module: m_nft
module mnft::mnft {
    use std::string::utf8;
    use sui::object::{Self, UID};
    use sui::coin::{Self, Coin};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::package;
    use sui::display;
    use std::vector;

    struct MNFT has drop {}

    struct M_NFT has key, store {
        id: UID,
        index: u64
    }

    struct SupplyManager has key, store {
        id: UID,
        starting_index: u64,
        current_supply: u64,
    }

    const TOTAL_SUPPLY: u64 = 1000000;
    const CAP_PER_SUPPLY_MANAGER: u64 = 500;
    const SUPPLY_MANAGER_COUNT: u64 = TOTAL_SUPPLY / CAP_PER_SUPPLY_MANAGER;

    // 1000000 / 5000 = 2000, will have 2000 supply managers in parallel.

    fun init(otw: MNFT, ctx: &mut TxContext) {
        let keys = vector[
            utf8(b"name"),
            utf8(b"image_url"),
            utf8(b"description"),
            utf8(b"project_url"),
            utf8(b"creator"),
        ];

        let values = vector[
            utf8(b"1 Million NFT in 90 second #{index}"),
            utf8(b"https://i.imgur.com/deg7u4X.png"),
            utf8(b"100k + 100k bounty! Yes! This is the {index}/1000000 th NFT!"),
            utf8(b"https://github.com/EasonC13/1M-NFT"),
            utf8(b"Eason"),
        ];

        let publisher = package::claim(otw, ctx);
        let display = display::new_with_fields<M_NFT>(
            &publisher, keys, values, ctx
        );
        display::update_version(&mut display);

        let deployer = tx_context::sender(ctx);
        transfer::public_transfer(publisher, deployer);
        transfer::public_transfer(display, deployer);

        let index = 0;
        loop {
            let supply_manager = SupplyManager{
                id: object::new(ctx),
                starting_index: index * CAP_PER_SUPPLY_MANAGER,
                current_supply: 0,
            };
            transfer::share_object(supply_manager);
            index = index + 1;
            if (index == SUPPLY_MANAGER_COUNT) {
                break
            }
        }
    }

    public fun mint(
        supplyManager: &mut SupplyManager,
        ctx: &mut TxContext,
    ): M_NFT {
        let nft = M_NFT {
            id: object::new(ctx),
            index: supplyManager.starting_index + supplyManager.current_supply,
        };
        assert!(supplyManager.current_supply < CAP_PER_SUPPLY_MANAGER, 0);
        supplyManager.current_supply = supplyManager.current_supply + 1;
        nft
    }

    public fun batch_mint_to(
        supplyManager: &mut SupplyManager,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let counter = 0;
        loop {
            let nft = mint(supplyManager, ctx);
            transfer::transfer(nft, recipient);
            counter = counter + 1;
            if (counter == amount) {
                break
            }
        };
    }

    public fun burn_nft (
        nft: M_NFT,
    ) {
        let M_NFT {id, index: _} = nft;
        object::delete(id);
    }

    public fun batch_burn_nfts (
        nfts: vector<M_NFT>,
    ) {
        loop {
            let nft = vector::pop_back<M_NFT>(&mut nfts);
            burn_nft(nft);
            if (0 == vector::length<M_NFT>(&nfts)) {
                break
            }
        };
        vector::destroy_empty(nfts);
    }
    
    #[allow(lint(self_transfer))]
    public fun split_gas_coins<T>(
        coin_input: Coin<T>,
        amount: u64,
        balacne_each: u64,
        ctx: &mut TxContext,
    ) {
        let counter = 0;
        loop {
            // coin::split(coin_input, split);
            let splitted_coin = coin::split(&mut coin_input, balacne_each, ctx);
            transfer::public_transfer(splitted_coin, tx_context::sender(ctx));
            counter = counter + 1;
            if (counter == amount) {
                break
            }
        };
        transfer::public_transfer(coin_input, tx_context::sender(ctx));
    }
}
