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
        });

        it('fails to transfer a token without enough balance', async function () {
            await contract.call('createToken', [154], {caller: alice});
            await expect(
                contract.call('transfer', [alice.address, bob.address, 10001], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });
    });

    describe('mint', function() {
        it('mints a token', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', [154], {caller: alice});
            // Mint 27 tokens
            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, token: "tti_564954455820434f494e69b5", value: 56133});
            // (await contract.balance()).to.be.deep.equal(['56133']); // Disabled due to amount bug
            // 1000000 - 56133 = 943867
            // expect(await alice.balance()).to.be.deep.equal(['943867']); // Disabled due to amount bug

            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.deep.equal(['10027']);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.deep.equal(['10027']);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.deep.equal(['27']);
            // 154 * 27 = 4158
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.deep.equal(['4158']);
        });

        it('mints a token twice', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', [154], {caller: alice});
            // Mint 27 tokens
            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, token: "tti_564954455820434f494e69b5", value: 56133});
            // expect(await contract.balance()).to.be.deep.equal(['56133']); // Disabled due to amount bug
            // 1000000 - 56133 = 943867
            // expect(await alice.balance()).to.be.deep.equal(['943867']); // Disabled due to amount bug

            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.deep.equal(['10027']);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.deep.equal(['10027']);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.deep.equal(['27']);
            // 154 * 27 = 4158
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.deep.equal(['4158']);

            // Mint 10 tokens
            // \int_27^37 154x dx = 49280
            await contract.call('mint', [alice.address, 10], {caller: alice, value: '49280'});
            // 56133 + 49280 = 105413
            // expect(await contract.balance()).to.be.deep.equal(['105413']); // Disabled due to amount bug
            // 1000000 - 105413 = 894587
            // expect(await alice.balance()).to.be.deep.equal(['894587']); // Disabled due to amount bug

            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.deep.equal(['10037']);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.deep.equal(['10037']);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.deep.equal(['37']);
            // 154 * 37 = 5698
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.deep.equal(['5698']);
        });

        it('fails to mint a non-existent token', async function() {
            await expect(
                contract.call('mint', [alice.address, 0], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });

        it('fails to mint 0 tokens', async function() {
            await contract.call('createToken', ['154'], {caller: alice});
            await expect(
                contract.call('mint', [alice.address, 0], {caller: alice, value: '56133'})
            ).to.eventually.be.rejectedWith('revert');
        });

        it.only('overpays a mint call', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', [154], {caller: alice});
            // Mint 27 tokens
            // \int_0^27 154x dx = 56133
            // We're gonna pay 56135
            await contract.call('mint', [alice.address, 27], {caller: alice, value: '56135'});
            
            // Overpaying should not change anything

            // (await contract.balance()).to.be.deep.equal(['56133']); // Disabled due to amount bug
            // 1000000 - 56133 = 943867
            // expect(await alice.balance()).to.be.deep.equal(['943867']); // Disabled due to amount bug

            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.deep.equal(['10027']);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.deep.equal(['10027']);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.deep.equal(['27']);
            // 154 * 27 = 4158
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.deep.equal(['4158']);
        })
    });

    describe('burn', function() {
        it('burns a token', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', ['154'], {caller: alice});

            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, value: '56133'});
            // expect(await contract.balance()).to.be.deep.equal(['56133']); // Disabled due to amount bug
            // 1000000 - 56133 = 943867
            // expect(await alice.balance()).to.be.deep.equal(['943867']); // Disabled due to amount bug
            
            await contract.call('burn', [alice.address, '2'], {caller: alice});

            // \int_27^25 154x dx = -8008
            // 56133 - 8008 = 48125
            // expect(await contract.balance()).to.be.deep.equal(['48125']); // Disabled due to amount bug
        
            // 943867 + 8008 = 951875
            // expect(await alice.balance()).to.be.deep.equal(['951875']); // Disabled due to amount bug

            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.deep.equal(['10025']);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.deep.equal(['10025']);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.deep.equal(['25']);

            // 25 * 154 = 3850
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.deep.equal(['3850']);
        });

        it('burns a token twice', async function() {
            await deployer.sendToken(alice.address, '1000000');
            await contract.call('createToken', ['154'], {caller: alice});

            // \int_0^27 154x dx = 56133
            await contract.call('mint', [alice.address, 27], {caller: alice, value: '56133'});
            // expect(await contract.balance()).to.be.deep.equal(['56133']); // Disabled due to amount bug
            // 1000000 - 56133 = 943867
            // expect(await alice.balance()).to.be.deep.equal(['943867']); // Disabled due to amount bug
            
            await contract.call('burn', [alice.address, '2'], {caller: alice});

            // \int_27^25 154x dx = -8008
            // 56133 - 8008 = 48125
            // expect(await contract.balance()).to.be.deep.equal(['48125']); // Disabled due to amount bug
        
            // 943867 + 8008 = 951875
            // expect(await alice.balance()).to.be.deep.equal(['951875']); // Disabled due to amount bug

            expect(await contract.query('balanceOf', [alice.address, alice.address], {caller: alice})).to.be.deep.equal(['10025']);
            expect(await contract.query('totalSupply', [alice.address], {caller: alice})).to.be.deep.equal(['10025']);
            expect(await contract.query('tradableSupply', [alice.address], {caller: alice})).to.be.deep.equal(['25']);

            // 25 * 154 = 3850
            expect(await contract.query('currentPrice', [alice.address], {caller: alice})).to.be.deep.equal(['3850']);

            // Burn all the remaining tradable tokens
            await contract.call('burn', [alice.address, '25'], {caller: alice});

            // \int_25^0 154x dx = -48125
            // 48125 - 48125 = 0
            // expect(await contract.balance()).to.be.deep.equal(['0']); // Disabled due to amount bug

            // 951875 + 48125 = 1000000
            // expect(await alice.balance()).to.be.deep.equal(['1000000']); // Disabled due to amount bug
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
            await contract.call('mint', [alice.address, 27], {caller: alice, token: "tti_564954455820434f494e69b5", value: 56133});
            // (await contract.balance()).to.be.deep.equal(['56133']); // Disabled due to amount bug
            // Alice's balance is now 1000000 - 56133 = 943867
            // expect(await alice.balance()).to.be.deep.equal(['943867']); // Disabled due to amount bug

            // Mint 89 Bob-tokens
            // \int_0^89 32x dx = 126736
            await contract.call('mint', [bob.address, 89], {caller: bob, token: "tti_564954455820434f494e69b5", value: 126736});
            // Contract's balance is now 56133 + 126736 = 182869
            // (await contract.balance()).to.be.deep.equal(['182869']); // Disabled due to amount bug
            // Bob's balance is now 1000000 - 126736 = 873264
            // expect(await bob.balance()).to.be.deep.equal(['873264']); // Disabled due to amount bug

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

            // 103 Bob-token are worth \int_89^103 32x dx = 43008
            // In other words, Alice didn't receive enough Bob-tokens to cover the full swap amount
            // The difference (45045 - 43008 = 2037) is refunded to Alice
            // Contract's balance is now 182869 - 2037 = 180832
            // expect(await contract.balance()).to.be.deep.equal(['180832']); // Disabled due to amount bug
            // Alice's balance is now 943867 + 2037 = 945904
            // expect(await alice.balance()).to.be.deep.equal(['945904']); // Disabled due to amount bug
        });

        it('fails to swap a non-existent token', async function() {
            await deployer.sendToken(alice.address, '1000000');

            await deployer.sendToken(bob.address, '1000000');
            await contract.call('createToken', ['32'], {caller: bob});

            // Mint 89 Bob-tokens
            // \int_0^89 32x dx = 126736
            await contract.call('mint', [bob.address, 89], {caller: bob, value: 126736});

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
            await contract.call('mint', [alice.address, 27], {caller: alice, value: 56133});

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
            await contract.call('mint', [alice.address, 27], {caller: alice, value: 56133});

            // Mint 89 Bob-tokens
            // \int_0^89 32x dx = 126736
            await contract.call('mint', [bob.address, 89], {caller: bob, value: 126736});

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
            await contract.call('mint', [alice.address, 27], {caller: alice, value: 56133});

            // Mint 89 Bob-tokens
            // \int_0^89 32x dx = 126736
            await contract.call('mint', [bob.address, 89], {caller: bob, value: 126736});

            // Only 154 Alice-tokens are tradable
            await expect(
                contract.call('swap', [alice.address, bob.address, '155'], {caller: alice})
            ).to.eventually.be.rejectedWith('revert');
        });
    });
});