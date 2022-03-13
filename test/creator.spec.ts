// NOTE: Queries are authomatically retried and don't fail (while calls do), so some query tests have been written as call tests.

import { describe } from "mocha";
import chai from "chai";
const vite = require('@vite/vuilder');
import chaiAsPromised from "chai-as-promised";
import config from "./vite.config.json";

chai.use(chaiAsPromised);
const expect = chai.expect;

let provider: any;
let deployer: any;
let alice: any;
let bob: any;
let charlie: any;
let contract: any;

const checkEvents = (result : any, correct : Array<Object>) => {
    expect(result).to.be.an('array').with.length(correct.length);
    for (let i = 0; i < correct.length; i++) {
        expect(result[i].returnValues).to.be.deep.equal(correct[i]);
    }
}

describe('test CreatorToken', function () {
    beforeEach(async function () {
        provider = vite.localProvider();
        // init users
        deployer = vite.newAccount(config.networks.local.mnemonic, 0);
        alice = vite.newAccount(config.networks.local.mnemonic, 1);
        bob = vite.newAccount(config.networks.local.mnemonic, 2);
        charlie = vite.newAccount(config.networks.local.mnemonic, 3);
        await deployer.sendToken(alice.address, '0');
        await alice.receiveAll();
        await deployer.sendToken(bob.address, '0');
        await bob.receiveAll();
        await deployer.sendToken(charlie.address, '0');
        await charlie.receiveAll();
        // compile
        const compiledContracts = await vite.compile('CreatorToken.solpp',);
        expect(compiledContracts).to.have.property('CreatorToken');
        contract = compiledContracts.CreatorToken;
        // deploy
        contract.setDeployer(deployer).setProvider(provider);
        await contract.deploy({params: [], responseLatency: 1});
        expect(contract.address).to.be.a('string');
    });

    describe('createToken', function() {
        it('creates a token', async function() {
            await contract.call('createToken', [154], {caller: alice});
            expect(await contract.query('exists', [alice.address], {caller: alice})).to.be.deep.equal(['1']);
            expect(await contract.query('tokenCoefficient', [alice.address], {caller: alice})).to.be.deep.equal(['154']);
            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.deep.equal(['10000']);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.deep.equal(['10000']);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.deep.equal(['0']);
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.deep.equal(['0']);

            // TODO: Check events
        });

        it('fails to create a token with an odd coefficient', async function() {
            await expect(
                contract.call('createToken', [153], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to create a token with coefficient 0', async function() {
            await expect(
                contract.call('createToken', [0], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to create a token twice', async function() {
            await contract.call('createToken', [154], {caller: bob});
            await expect(
                contract.call('createToken', [154], {caller: bob})
            ).to.eventually.be.rejectedWith('revert');
        });
    });

    describe('transfer', function() {
        it('transfers a token', async function () {
            await contract.call('createToken', [154], {caller: alice});
            await contract.call('transfer', [alice.address, bob.address, '1'], {caller: alice});

            const events = await contract.getPastEvents('allEvents', {fromHeight: 0, toHeight: 100});
            checkEvents(events, [
                { '0': alice.address, tokenId: alice.address }, // Token created
                {
                    '0': alice.address, tokenId: alice.address,
                    '1': alice.address, from: alice.address,
                    '2': bob.address, to: bob.address,
                    '3': '1', amount: '1'
                } // Token transferred
            ])
        });

        it('fails to transfer a token without enough balance', async function () {
            await contract.call('createToken', [154], {caller: alice});
            await expect(
                contract.call('transfer', [alice.address, bob.address, 10001], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });
    });

    describe('mint', function() {
        it.only('mints a token', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await alice.receiveAll();
            await contract.call('createToken', [154], {caller: alice});
            // Mint 27 tokens
            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});
            expect(await contract.balance()).to.be.deep.equal('56133');
            // 1000000 - 56133 = 943867
            expect(await alice.balance()).to.be.deep.equal('943867');

            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.deep.equal(['10027']);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.deep.equal(['10027']);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.deep.equal(['27']);
            // 154 * 27 = 4158
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.deep.equal(['4158']);

            const events = await contract.getPastEvents('allEvents', {fromHeight: 0, toHeight: 100});
            checkEvents(events, [
                { '0': alice.address, tokenId: alice.address }, // Token created
                {
                    '0': alice.address, tokenId: alice.address,
                    '1': alice.address, owner: alice.address,
                    '2': '27', amount: '27'
                } // Token minted
            ]);
        });

        it.only('mints a token twice', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await alice.receiveAll();
            expect(await alice.balance()).to.be.deep.equal('1000000')
            await contract.call('createToken', [154], {caller: alice});
            // Mint 27 tokens
            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});
            expect(await contract.balance()).to.be.deep.equal('56133');
            // 1000000 - 56133 = 943867
            expect(await alice.balance()).to.be.deep.equal('943867');

            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.deep.equal(['10027']);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.deep.equal(['10027']);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.deep.equal(['27']);
            // 154 * 27 = 4158
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.deep.equal(['4158']);

            // Mint 10 tokens
            // \int_27^37 154x dx = 49280
            await contract.call('mint', [alice.address, 10], {caller: alice, amount: '49280'});
            // 56133 + 49280 = 105413
            expect(await contract.balance()).to.be.deep.equal('105413');
            // 1000000 - 105413 = 894587
            expect(await alice.balance()).to.be.deep.equal('894587');

            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.deep.equal(['10037']);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.deep.equal(['10037']);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.deep.equal(['37']);
            // 154 * 37 = 5698
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.deep.equal(['5698']);

            const events = await contract.getPastEvents('allEvents', {fromHeight: 0, toHeight: 100});
            checkEvents(events, [
                { '0': alice.address, tokenId: alice.address }, // Token created
                {
                    '0': alice.address, tokenId: alice.address,
                    '1': alice.address, owner: alice.address,
                    '2': '27', amount: '27'
                }, // Token minted
                {
                    '0': alice.address, tokenId: alice.address,
                    '1': alice.address, owner: alice.address,
                    '2': '10', amount: '10'
                }, // Token minted
            ]);
        });

        it('fails to mint a non-existent token', async function() {
            await expect(
                contract.call('mint', [alice.address, 0], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to mint 0 tokens', async function() {
            await contract.call('createToken', ['154'], {caller: alice});
            await expect(
                contract.call('mint', [alice.address, 0], {caller: alice, amount: '56133'})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('overpays a mint call', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', [154], {caller: alice});
            // Mint 27 tokens
            // \int_0^27 154x dx = 56133
            // We're gonna pay 56135
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56135'});
            
            // Overpaying should not change anything

            expect(await contract.balance()).to.be.deep.equal('56133');
            // 1000000 - 56133 = 943867
            expect(await alice.balance()).to.be.deep.equal('943867');

            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.deep.equal(['10027']);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.deep.equal(['10027']);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.deep.equal(['27']);
            // 154 * 27 = 4158
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.deep.equal(['4158']);
        })

        it('fails to underpay a mint call', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', [154], {caller: alice});
            // Mint 27 tokens
            // \int_0^27 154x dx = 56133
            // We're gonna pay 56132

            await expect(
                contract.call('mint', [alice.address, 0], {caller: alice, amount: '56132'})
            ).to.eventually.be.rejectedWith('revert');
        });
    });

    describe('burn', function() {
        it('burns a token', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', ['154'], {caller: alice});

            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});
            expect(await contract.balance()).to.be.deep.equal('56133');
            // 1000000 - 56133 = 943867
            expect(await alice.balance()).to.be.deep.equal('943867');
            
            await contract.call('burn', [alice.address, '2'], {caller: alice});

            // \int_27^25 154x dx = -8008
            // 56133 - 8008 = 48125
            expect(await contract.balance()).to.be.deep.equal('48125');
        
            // 943867 + 8008 = 951875
            expect(await alice.balance()).to.be.deep.equal('951875');

            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.deep.equal(['10025']);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.deep.equal(['10025']);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.deep.equal(['25']);

            // 25 * 154 = 3850
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.deep.equal(['3850']);

            const events = await contract.getPastEvents('allEvents', {fromHeight: 0, toHeight: 100});
            checkEvents(events, [
                { '0': alice.address, tokenId: alice.address }, // Token created
                {
                    '0': alice.address, tokenId: alice.address,
                    '1': alice.address, owner: alice.address,
                    '2': '27', amount: '27'
                }, // Token minted
                {
                    '0': alice.address, tokenId: alice.address,
                    '1': alice.address, owner: alice.address,
                    '2': '2', amount: '2'
                }, // Token burned
            ]);
        });

        it('burns a token twice', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', ['154'], {caller: alice});

            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});
            expect(await contract.balance()).to.be.deep.equal('56133');
            // 1000000 - 56133 = 943867
            expect(await alice.balance()).to.be.deep.equal('943867');
            
            await contract.call('burn', [alice.address, '2'], {caller: alice});

            // \int_27^25 154x dx = -8008
            // 56133 - 8008 = 48125
            expect(await contract.balance()).to.be.deep.equal('48125');
        
            // 943867 + 8008 = 951875
            expect(await alice.balance()).to.be.deep.equal('951875');

            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.deep.equal(['10025']);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.deep.equal(['10025']);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.deep.equal(['25']);

            // 25 * 154 = 3850
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.deep.equal(['3850']);

            // Burn all the remaining tradable tokens
            await contract.call('burn', [alice.address, '25'], {caller: alice});

            // \int_25^0 154x dx = -48125
            // 48125 - 48125 = 0
            expect(await contract.balance()).to.be.deep.equal('0');

            // 951875 + 48125 = 1000000
            expect(await alice.balance()).to.be.deep.equal('1000000');
        });

        it('fails to burn a non-existent token', async function() {
            await expect(
                contract.call('burn', [alice.address, '1'], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to burn a token with 0 amount', async function() {
            await contract.call('createToken', ['154'], {caller: alice});
            await expect(
                contract.call('burn', [alice.address, '0'], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to burn a token with an amount greater than the tradable supply', async function() {
            await contract.call('createToken', ['154'], {caller: alice});
            await expect(
                contract.call('burn', [alice.address, '15'], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });
    });

    describe('swap', function() {
        it('swaps two tokens', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', ['154'], {caller: alice});

            await deployer.sendToken(bob.address, '1000000');
            await contract.call('createToken', ['32'], {caller: bob});

            // Mint 27 Alice-tokens
            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});
            expect(await contract.balance()).to.be.deep.equal('56133');
            // Alice's balance is now 1000000 - 56133 = 943867
            expect(await alice.balance()).to.be.deep.equal('943867');

            // Mint 89 Bob-tokens
            // \int_0^89 32x dx = 126736
            await contract.call('mint', [bob.address, 89], {caller: bob, amount: '126736'});
            // Contract's balance is now 56133 + 126736 = 182869
            expect(await contract.balance()).to.be.deep.equal('182869');
            // Bob's balance is now 1000000 - 126736 = 873264
            expect(await bob.balance()).to.be.deep.equal('873264');

            // Swap 15 Alice-tokens for the equivalent amount of Bob-tokens
            // \int_27^12 154x dx = -45045
            // \int_89^t 32x dx = 45045 has solution t = 103.62
            // Since the contract rounds down, the actual value is 103
            // In other words, the contract will swap 15 Alice-tokens for (103-89 = 14) Bob-tokens
            await contract.call('swap', [alice.address, bob.address, '15'], {caller: alice});

            // 27 Alice-tokens - 15 = 12
            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.deep.equal(['10012']);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.deep.equal(['10012']);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.deep.equal(['12']);

            // Alice now has 14 Bob-tokens
            expect(await contract.query('balanceOf', [bob.address, alice.address], {caller: alice})).to.be.deep.equal(['14']);
            // Bob's balance didn't change
            expect(await contract.query('balanceOf', [bob.address, bob.address], {caller: bob})).to.be.deep.equal(['10089']);

            // 89 Bob-tokens + 14 = 103
            expect(await contract.query('totalSupply', [bob.address], {caller: bob})).to.be.deep.equal(['10103']);
            expect(await contract.query('tradableSupply', [bob.address], {caller: bob})).to.be.deep.equal(['103']);

            // The new Bob-tokens are worth \int_89^103 32x dx = 43008
            // In other words, Alice didn't receive enough Bob-tokens to cover the full swap amount
            // The difference (45045 - 43008 = 2037) is refunded to Alice
            // Contract's balance is now 182869 - 2037 = 180832
            expect(await contract.balance()).to.be.deep.equal('180832');
            // Alice's balance is now 943867 + 2037 = 945904
            expect(await alice.balance()).to.be.deep.equal('945904');

            const events = await contract.getPastEvents('allEvents', {fromHeight: 0, toHeight: 100});
            checkEvents(events, [
                { '0': alice.address, tokenId: alice.address }, // Alice-token created
                { '0': bob.address, tokenId: bob.address }, // Bob-token created
                {
                    '0': alice.address, tokenId: alice.address,
                    '1': alice.address, owner: alice.address,
                    '2': '27', amount: '27'
                }, // Alice-token minted by Alice
                {
                    '0': bob.address, tokenId: bob.address,
                    '1': bob.address, owner: bob.address,
                    '2': '89', amount: '89'
                }, // Bob-token minted by Bob
                {
                    '0': alice.address, tokenId: alice.address,
                    '1': alice.address, owner: alice.address,
                    '2': '15', amount: '15'
                }, // Alice-token burned by Alice
                {
                    '0': bob.address, tokenId: bob.address,
                    '1': alice.address, owner: alice.address,
                    '2': '14', amount: '14'
                } // Bob-token minted by Alice
            ]);
        });

        it('fails to swap a non-existent token', async function() {
            await deployer.sendToken(alice.address, '1000000');

            await deployer.sendToken(bob.address, '1000000');
            await contract.call('createToken', ['32'], {caller: bob});

            // Mint 89 Bob-tokens
            // \int_0^89 32x dx = 126736
            await contract.call('mint', [bob.address, 89], {caller: bob, amount: '126736'});

            await expect(
                contract.call('swap', [alice.address, bob.address, '15'], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to swap a token for a non-existent token', async function() {
            await deployer.sendToken(alice.address, '1000000');

            await deployer.sendToken(bob.address, '1000000');
            await contract.call('createToken', ['154'], {caller: alice});

            // Mint 27 Alice-tokens
            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});

            await expect(
                contract.call('swap', [alice.address, bob.address, '15'], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to swap 0 tokens', async function() {
            await deployer.sendToken(alice.address, '1000000');

            await deployer.sendToken(bob.address, '1000000');
            await contract.call('createToken', ['154'], {caller: alice});

            await deployer.sendToken(bob.address, '1000000');
            await contract.call('createToken', ['32'], {caller: bob});

            // Mint 27 Alice-tokens
            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});

            // Mint 89 Bob-tokens
            // \int_0^89 32x dx = 126736
            await contract.call('mint', [bob.address, 89], {caller: bob, amount: '126736'});

            await expect(
                contract.call('swap', [alice.address, bob.address, '0'], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to swap more tokens than the tradable amount', async function() {
            await deployer.sendToken(alice.address, '1000000');

            await deployer.sendToken(bob.address, '1000000');
            await contract.call('createToken', ['154'], {caller: alice});

            await deployer.sendToken(bob.address, '1000000');
            await contract.call('createToken', ['32'], {caller: bob});

            // Mint 27 Alice-tokens
            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});

            // Mint 89 Bob-tokens
            // \int_0^89 32x dx = 126736
            await contract.call('mint', [bob.address, 89], {caller: bob, amount: '126736'});

            // Only 154 Alice-tokens are tradable
            await expect(
                contract.call('swap', [alice.address, bob.address, '155'], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to swap more tokens than the balance', async function() {
            await deployer.sendToken(alice.address, '1000000');

            await deployer.sendToken(bob.address, '1000000');
            await contract.call('createToken', ['154'], {caller: alice});

            await deployer.sendToken(bob.address, '1000000');
            await contract.call('createToken', ['32'], {caller: bob});

            // Transfer 10000 Alice-tokens to Bob
            await contract.call('transfer', [alice.address, bob.address, '10000'], {caller: alice});

            // Mint 27 Alice-tokens
            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});

            // Mint 89 Bob-tokens
            // \int_0^89 32x dx = 126736
            await contract.call('mint', [bob.address, 89], {caller: bob, amount: '126736'});

            // Alice only has 27 Alice-tokens
            await expect(
                contract.call('swap', [alice.address, bob.address, '28'], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });
    });

    describe('simulateSwap', function() {
        it('simulates a swap of two tokens', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', ['154'], {caller: alice});

            await deployer.sendToken(bob.address, '1000000');
            await contract.call('createToken', ['32'], {caller: bob});

            // Mint 27 Alice-tokens
            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});
            expect(await contract.balance()).to.be.deep.equal('56133');
            // Alice's balance is now 1000000 - 56133 = 943867
            expect(await alice.balance()).to.be.deep.equal('943867');

            // Mint 89 Bob-tokens
            // \int_0^89 32x dx = 126736
            await contract.call('mint', [bob.address, 89], {caller: bob, amount: '126736'});
            // Contract's balance is now 56133 + 126736 = 182869
            expect(await contract.balance()).to.be.deep.equal('182869');
            // Bob's balance is now 1000000 - 126736 = 873264
            expect(await bob.balance()).to.be.deep.equal('873264');

            // Swap 15 Alice-tokens for the equivalent amount of Bob-tokens
            // \int_27^12 154x dx = -45045
            // \int_89^t 32x dx = 45045 has solution t = 103.62
            // Since the contract rounds down, the actual value is 103
            // In other words, the contract will swap 15 Alice-tokens for (103-89 = 14) Bob-tokens
            // 103 Bob-token are worth \int_89^103 32x dx = 43008
            // In other words, Alice didn't receive enough Bob-tokens to cover the full swap amount
            // The difference (45045 - 43008 = 2037) is refunded to Alice
            expect(await contract.query('simulateSwap', [alice.address, bob.address, '15'], {caller: alice})).to.be.deep.equal(['14', '2037']);
        });

        it('fails to simulate a swap of a non-existent token', async function() {
            await deployer.sendToken(alice.address, '1000000');

            await deployer.sendToken(bob.address, '1000000');
            await contract.call('createToken', ['32'], {caller: bob});

            // Mint 89 Bob-tokens
            // \int_0^89 32x dx = 126736
            await contract.call('mint', [bob.address, 89], {caller: bob, amount: '126736'});

            await expect(
                contract.call('simulateSwap', [alice.address, bob.address, '15'], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to simulate a swap of a token for a non-existent token', async function() {
            await deployer.sendToken(alice.address, '1000000');

            await deployer.sendToken(bob.address, '1000000');
            await contract.call('createToken', ['154'], {caller: alice});

            // Mint 27 Alice-tokens
            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});

            await expect(
                contract.call('simulateSwap', [alice.address, bob.address, '15'], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to simulate a swap of more tokens than the tradable amount', async function() {
            await deployer.sendToken(alice.address, '1000000');

            await deployer.sendToken(bob.address, '1000000');
            await contract.call('createToken', ['154'], {caller: alice});

            await deployer.sendToken(bob.address, '1000000');
            await contract.call('createToken', ['32'], {caller: bob});

            // Mint 27 Alice-tokens
            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});

            // Mint 89 Bob-tokens
            // \int_0^89 32x dx = 126736
            await contract.call('mint', [bob.address, 89], {caller: bob, amount: '126736'});

            // Only 154 Alice-tokens are tradable
            await expect(
                contract.call('simulateSwap', [alice.address, bob.address, '155'], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });
    });

    describe('mintCost', function() {
        it('computes the cost of a mint', async function () {
            await contract.call('createToken', [154], {caller: alice});
            // Mint 27 tokens
            // \int_0^27 154x dx = 56133
            expect(await contract.query('mintCost', [alice.address, 27], {caller: alice})).to.be.deep.equal(['56133']);
        });

        it('fails to compute the cost of a mint of a non-existent token', async function () {
            // Mint 27 tokens
            // \int_0^27 154x dx = 56133
            await expect(
                contract.call('mintCost', [alice.address, 27], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });
    });

    describe('mintAmount', function() {
        it('computes the mint amount', async function () {
            await contract.call('createToken', [154], {caller: alice});
            // Mint 27 tokens
            // \int_0^27 154x dx = 56133
            expect(await contract.query('mintAmount', [alice.address, 56133], {caller: alice})).to.be.deep.equal(['27']);
        });

        it('fails to compute the mint amount of a non-existent token', async function () {
            // Mint 27 tokens
            // \int_0^27 154x dx = 56133
            await expect(
                contract.call('mintAmount', [alice.address, 56133], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });
    });

    describe('burnRevenue', function() {
        it('computes the burn revenue', async function () {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', [154], {caller: alice});

            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});

            // \int_27^25 154x dx = -8008
            expect(await contract.query('burnRevenue', [alice.address, 2], {caller: alice})).to.be.deep.equal(['8008']);
        });

        it('fails to compute the burn revenue of a non-existent token', async function () {
            await expect(
                contract.call('burnRevenue', [alice.address, 2], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to compute the burn revenue that would cause the supply to go below the minimum', async function () {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', ['154'], {caller: alice});

            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});

            // \int_27^0 154x dx = -56133
            // We will use 28
            await expect(
                contract.call('burnRevenue', [alice.address, 28], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });
    });

    describe('burnAmount', function() {
        it('computes the burn amount', async function () {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', [154], {caller: alice});

            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});

            // \int_27^25 154x dx = -8008
            expect(await contract.query('burnAmount', [alice.address, 8008], {caller: alice})).to.be.deep.equal(['2']);
        });

        it('fails to compute the burn amount of a non-existent token', async function () {
            await expect(
                contract.call('burnAmount', [alice.address, 8008], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to compute the burn amount that would cause the supply to go below the minimum', async function () {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', ['154'], {caller: alice});

            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, amount: '56133'});

            // \int_27^0 154x dx = -56133
            // \int_28^0 154x = -60368
            // We will use 60368
            await expect(
                contract.call('burnAmount', [alice.address, 60368], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });
    });
});