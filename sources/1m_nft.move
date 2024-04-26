/// Module: m_nft
module mnft::mnft {
    use std::string::utf8;
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::package;
    use sui::display;

    struct MNFT has drop {}

    struct M_NFT has key, store {
        id: UID
    }

    struct SupplyManager has key, store {
        id: UID,
        current_supply: u64,
    }

    const TOTAL_SUPPLY: u64 = 10000000;
    const CAP_PER_SUPPLY_MANAGER: u64 = 100000;
    const SUPPLY_MANAGER_COUNT: u64 = TOTAL_SUPPLY / CAP_PER_SUPPLY_MANAGER;

    fun init(otw: MNFT, ctx: &mut TxContext) {
        let keys = vector[
            utf8(b"name"),
            utf8(b"image_url"),
            utf8(b"description"),
            utf8(b"project_url"),
            utf8(b"creator"),
        ];

        let values = vector[
            utf8(b"1 Million NFT in 90 second"),
            utf8(b"https://i.imgur.com/deg7u4X.png"),
            utf8(b"100k bounty! Yes!"),
            utf8(b"https://github.com/EasonC13"),
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
        };
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
}
