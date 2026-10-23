secure voting system setup

files

SecureVoting.sol contains the smart contract
index.html contains the webpage structure
app.js contains the metamask and web3.js functions
style.css contains basic page formatting

deployment

1. open SecureVoting.sol in remix
2. compile it using solidity 0.8.20 or a compatible 0.8.x compiler
3. select browser extension or metamask in deploy and run transactions
4. make sure metamask is connected to sepolia
5. deploy using the account which should become the admin
6. copy the deployed contract address
7. replace paste_deployed_contract_address_here in app.js with the address
8. run the project using a local web server such as live server in visual studio code
9. open index.html through the local server and connect metamask
10. after changing accounts in metamask, press connect metamask again to update the page account

commit and reveal process

1. the voter selects an option and enters a private secret
2. the calculate commitment button uses a read-only contract call to create the hash
3. the voter submits only the hash during the voting phase
4. the voter keeps the selected option and secret private
5. after the admin ends voting, the voter enters the same option and secret
6. the contract recreates the hash and counts the vote only when it matches

important

the secret is not stored by the webpage
the voter must remember the exact option and secret used for the commitment
the final deployed address must be added before submission
the web3.js library is loaded using the lecture cdn link
