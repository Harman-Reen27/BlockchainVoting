// where address from deployment goes 
const contractAddress = "";

// this abi contains the functions used by the interface
const contractABI = [
    {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
    {"inputs":[{"internalType":"address","name":"voter","type":"address"}],"name":"addEligibleVoter","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"},{"internalType":"uint256","name":"optionIndex","type":"uint256"},{"internalType":"string","name":"secret","type":"string"}],"name":"calculateCommitment","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"canPrepareElection","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"bytes32","name":"hiddenVote","type":"bytes32"}],"name":"commitVote","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"endVoting","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"finaliseElection","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"getAdmin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"getCurrentElectionId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"}],"name":"getElectionInformation","outputs":[{"internalType":"string","name":"","type":"string"},{"internalType":"enum SecureVoting.Phase","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"}],"name":"getElectionOptions","outputs":[{"internalType":"string[]","name":"","type":"string[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"getEligibleVoters","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"getMyVotingStatus","outputs":[{"internalType":"bool","name":"","type":"bool"},{"internalType":"bool","name":"","type":"bool"},{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"}],"name":"getParticipationTotals","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"}],"name":"getResults","outputs":[{"internalType":"string[]","name":"","type":"string[]"},{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"}],"name":"getWinners","outputs":[{"internalType":"string[]","name":"","type":"string[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"string","name":"topic","type":"string"},{"internalType":"string[]","name":"optionList","type":"string[]"}],"name":"prepareElection","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"voter","type":"address"}],"name":"removeEligibleVoter","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"resetElection","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"optionIndex","type":"uint256"},{"internalType":"string","name":"secret","type":"string"}],"name":"revealVote","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"startVoting","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

// stores the current web3 connection and contract information
let web3;
let votingContract;
let currentAccount = "";
let adminAddress = "";
let currentElectionId = 0;
let currentPhase = -1;
let currentEligible = false;
let currentCommitted = false;
let currentRevealed = false;
let calculatedCommitment = "";

// stores the readable name for each enum value
const phaseNames = ["setup", "voting", "reveal", "finalised"];

// updates the text inside one page element
function setText(elementId, value) {
    document.getElementById(elementId).textContent = value;
}

// returns a shorter error message for the intrface
function getErrorMessage(error) {
    if (!error) {
        return "the action could not be completed";
    }

    if (error.code === 4001) {
        return "the transaction was rejected in metamask";
    }

    if (error.data && error.data.message) {
        return error.data.message;
    }

    if (error.message) {
        const reason = error.message.match(/revert(?:ed)?(?: with reason string)?[ ':\"]+([^'\"]+)/i);

        if (reason) {
            return reason[1];
        }

        return error.message;
    }

    return "the action could not be completed";
}

//connects the page to metamask and creates the contract object
async function connectWallet() {
    try {
        if (!window.ethereum) {
            throw new Error("metamask is not installed in this browser");
        }

        if (contractAddress.startsWith("paste_")) {
            throw new Error("enter the deployed contract address in app.js first");
        }

        web3 = new Web3(window.ethereum);

        const accounts = await window.ethereum.request({
            method: "eth_requestAccounts"
        });

        currentAccount = accounts[0];
        votingContract = new web3.eth.Contract(contractABI, contractAddress);

        setText("connectionMessage", "wallet connected successfully");

        await refreshInformation();
    } catch (error) {
        setText("connectionMessage", getErrorMessage(error));
    }
}

// reads the current wallet and election information
async function refreshInformation() {
    if (!votingContract || !currentAccount) {
        return;
    }

    try {
        const networkId = Number(await web3.eth.net.getId());
        const balanceWei = await web3.eth.getBalance(currentAccount);

        adminAddress = await votingContract.methods.getAdmin().call();
        currentElectionId = Number(
            await votingContract.methods.getCurrentElectionId().call()
        );

        setText("walletAddress", currentAccount);
        setText(
            "networkName",
            networkId === 11155111 ? "sepolia" : "network id " + networkId
        );
        setText(
            "walletBalance",
            Number(web3.utils.fromWei(balanceWei, "ether")).toFixed(5) + " eth"
        );
        setText(
            "walletRole",
            currentAccount.toLowerCase() === adminAddress.toLowerCase()
                ? "admin"
                : "voter"
        );
        setText("electionIdDisplay", currentElectionId);

        if (currentElectionId === 0) {
            currentPhase = -1;
            currentEligible = false;
            currentCommitted = false;
            currentRevealed = false;

            setText("topicDisplay", "no election prepared");
            setText("phaseDisplay", "-");
            setText("eligibleDisplay", "-");
            setText("committedDisplay", "-");
            setText("revealedDisplay", "-");

            displayOptions([]);
            updateWarnings();
            return;
        }

        const electionInformation = await votingContract.methods
            .getElectionInformation(currentElectionId)
            .call();

        const electionOptions = await votingContract.methods
            .getElectionOptions(currentElectionId)
            .call();

        const votingStatus = await votingContract.methods
            .getMyVotingStatus()
            .call({ from: currentAccount });

        currentPhase = Number(electionInformation[1]);
        currentEligible = votingStatus[0];
        currentCommitted = votingStatus[1];
        currentRevealed = votingStatus[2];

        setText("topicDisplay", electionInformation[0]);
        setText("phaseDisplay", phaseNames[currentPhase]);
        setText("eligibleDisplay", currentEligible ? "yes" : "no");
        setText("committedDisplay", currentCommitted ? "yes" : "no");
        setText("revealedDisplay", currentRevealed ? "yes" : "no");

        if (!document.getElementById("resultElectionInput").value) {
            document.getElementById("resultElectionInput").value = currentElectionId;
        }

        displayOptions(electionOptions);
        updateWarnings();
    } catch (error) {
        setText("connectionMessage", getErrorMessage(error));
    }
}

// places election options into the page and both voter lists
function displayOptions(options) {
    const optionDisplay = document.getElementById("optionDisplay");
    const commitSelect = document.getElementById("commitOptionInput");
    const revealSelect = document.getElementById("revealOptionInput");

    optionDisplay.innerHTML = "";
    commitSelect.innerHTML = "";
    revealSelect.innerHTML = "";

    if (options.length === 0) {
        const emptyCommitOption = document.createElement("option");
        emptyCommitOption.value = "";
        emptyCommitOption.textContent = "no options available";
        commitSelect.appendChild(emptyCommitOption);

        const emptyRevealOption = emptyCommitOption.cloneNode(true);
        revealSelect.appendChild(emptyRevealOption);
        return;
    }

    options.forEach((optionText, optionIndex) => {
        const optionLine = document.createElement("p");
        optionLine.textContent = optionIndex + ": " + optionText;
        optionDisplay.appendChild(optionLine);

        const commitOption = document.createElement("option");
        commitOption.value = optionIndex;
        commitOption.textContent = optionText;
        commitSelect.appendChild(commitOption);

        const revealOption = commitOption.cloneNode(true);
        revealSelect.appendChild(revealOption);
    });
}

// displays guidance while keeping every action available for testing
function updateWarnings() {
    const connected = Boolean(currentAccount);
    const isAdmin = connected &&
        currentAccount.toLowerCase() === adminAddress.toLowerCase();

    let prepareWarning = "";
    let voterWarning = "";
    let phaseWarning = "";
    let commitWarning = "";
    let revealWarning = "";
    let resultWarning = "";

    if (!connected) {
        prepareWarning = "connect metamask first";
        voterWarning = "connect metamask first";
        phaseWarning = "connect metamask first";
        commitWarning = "connect metamask first";
        revealWarning = "connect metamask first";
        resultWarning = "connect metamask first";
    } else {
        if (!isAdmin) {
            prepareWarning = "only the admin can prepare an election";
            voterWarning = "only the admin can manage voter eligibility";
            phaseWarning = "only the admin can change the election phase";
        }

        if (isAdmin) {
            commitWarning = "the admin cannot vote";
            revealWarning = "the admin cannot reveal a vote";
        } else if (currentPhase !== 1) {
            commitWarning = "commitments can only be submitted during voting";
        } else if (!currentEligible) {
            commitWarning = "your address is not eligible for this election";
        } else if (currentCommitted) {
            commitWarning = "you have already submitted a commitment";
        }

        if (!isAdmin && currentPhase !== 2) {
            revealWarning = "votes can only be revealed during the reveal phase";
        } else if (!isAdmin && !currentCommitted) {
            revealWarning = "you did not submit a commitment";
        } else if (!isAdmin && currentRevealed) {
            revealWarning = "you have already revealed your vote";
        }

        if (currentPhase !== 3) {
            resultWarning = "results are only available after finalisation";
        }
    }

    setText("prepareWarning", prepareWarning);
    setText("voterWarning", voterWarning);
    setText("phaseWarning", phaseWarning);
    setText("commitWarning", commitWarning);
    setText("revealWarning", revealWarning);
    setText("resultWarning", resultWarning);
}

// sends a state changing contract transaction through metamask
async function sendTransaction(createMethod, successMessage) {
    try {
        if (!votingContract || !currentAccount) {
            throw new Error("connect metamask first");
        }

        setText("transactionMessage", "waiting for metamask confirmation");

        const receipt = await createMethod().send({
            from: currentAccount
        });

        setText(
            "transactionMessage",
            successMessage + "\ntransaction hash: " + receipt.transactionHash
        );

        await refreshInformation();
    } catch (error) {
        setText("transactionMessage", getErrorMessage(error));
    }
}

// reads setup fields and prepares a new election
async function prepareElection() {
    const topic = document.getElementById("topicInput").value.trim();
    const options = document.getElementById("optionInput").value
        .split("\n")
        .map(option => option.trim())
        .filter(option => option.length > 0);

    await sendTransaction(
        () => votingContract.methods.prepareElection(topic, options),
        "election prepared"
    );
}

// adds or removes the entered voter address
async function changeVoterEligibility(addVoter) {
    const voterAddress = document
        .getElementById("voterAddressInput")
        .value
        .trim();

    if (addVoter) {
        await sendTransaction(
            () => votingContract.methods.addEligibleVoter(voterAddress),
            "eligible voter added"
        );
    } else {
        await sendTransaction(
            () => votingContract.methods.removeEligibleVoter(voterAddress),
            "eligible voter removed"
        );
    }
}

// retrieves the current eligible voter list for the admin
async function viewEligibleVoters() {
    try {
        if (!votingContract || !currentAccount) {
            throw new Error("connect metamask first");
        }

        const voterList = await votingContract.methods
            .getEligibleVoters()
            .call({ from: currentAccount });

        setText(
            "eligibleVoterList",
            voterList.length > 0
                ? voterList.join("\n")
                : "no eligible voters have been added"
        );
    } catch (error) {
        setText("eligibleVoterList", getErrorMessage(error));
    }
}

// calculates the hidden commitment before it is sent to the contract
async function calculateCommitment() {
    try {
        if (!web3 || !currentAccount) {
            throw new Error("connect metamask first");
        }

        const optionIndex = document.getElementById("commitOptionInput").value;
        const secret = document.getElementById("secretInput").value;

        if (optionIndex === "") {
            throw new Error("select a voting option");
        }

        if (secret.trim().length === 0) {
            throw new Error("enter a private secret");
        }

        calculatedCommitment = await votingContract.methods
            .calculateCommitment(
                currentElectionId,
                optionIndex,
                secret
            )
            .call({ from: currentAccount });

        setText("commitmentDisplay", calculatedCommitment);
    } catch (error) {
        calculatedCommitment = "";
        setText("commitmentDisplay", getErrorMessage(error));
    }
}

// submits the commitment calculated in the browser
async function submitCommitment() {
    if (!calculatedCommitment) {
        setText("transactionMessage", "calculate the commitment first");
        return;
    }

    await sendTransaction(
        () => votingContract.methods.commitVote(calculatedCommitment),
        "vote commitment submitted"
    );
}

// reveals the option and secret during the reveal phase
async function revealVote() {
    const optionIndex = document.getElementById("revealOptionInput").value;
    const secret = document.getElementById("revealSecretInput").value;

    await sendTransaction(
        () => votingContract.methods.revealVote(optionIndex, secret),
        "vote revealed and counted"
    );
}

// reads final results for the selected election id
async function viewResult() {
    try {
        if (!votingContract) {
            throw new Error("connect metamask first");
        }

        const electionId = document.getElementById("resultElectionInput").value;
        const results = await votingContract.methods.getResults(electionId).call();
        const winners = await votingContract.methods.getWinners(electionId).call();
        const totals = await votingContract.methods
            .getParticipationTotals(electionId)
            .call();

        const resultDisplay = document.getElementById("resultDisplay");
        resultDisplay.innerHTML = "";

        results[0].forEach((optionText, optionIndex) => {
            const resultRow = document.createElement("div");
            resultRow.className = "resultRow";

            const optionName = document.createElement("span");
            optionName.textContent = optionText;

            const optionVotes = document.createElement("span");
            optionVotes.textContent = results[1][optionIndex] + " vote(s)";

            resultRow.appendChild(optionName);
            resultRow.appendChild(optionVotes);
            resultDisplay.appendChild(resultRow);
        });

        const winnerLine = document.createElement("p");
        winnerLine.className = "winner";
        winnerLine.textContent = winners.length > 0
            ? "winner(s): " + winners.join(", ")
            : "no winner because no valid votes were revealed";

        const totalLine = document.createElement("p");
        totalLine.textContent =
            "commitments: " + totals[0] + ", valid reveals: " + totals[1];

        resultDisplay.appendChild(winnerLine);
        resultDisplay.appendChild(totalLine);
        setText("resultWarning", "");
    } catch (error) {
        setText("resultWarning", getErrorMessage(error));
    }
}

// connects all visible buttons to their functions
document.getElementById("connectButton").addEventListener("click", connectWallet);
document.getElementById("refreshButton").addEventListener("click", refreshInformation);
document.getElementById("prepareButton").addEventListener("click", prepareElection);
document.getElementById("addVoterButton").addEventListener("click", () => changeVoterEligibility(true));
document.getElementById("removeVoterButton").addEventListener("click", () => changeVoterEligibility(false));
document.getElementById("viewVotersButton").addEventListener("click", viewEligibleVoters);
document.getElementById("startButton").addEventListener("click", () => sendTransaction(() => votingContract.methods.startVoting(), "voting started"));
document.getElementById("endButton").addEventListener("click", () => sendTransaction(() => votingContract.methods.endVoting(), "voting ended and reveal phase started"));
document.getElementById("finaliseButton").addEventListener("click", () => sendTransaction(() => votingContract.methods.finaliseElection(), "election finalised"));
document.getElementById("resetButton").addEventListener("click", () => sendTransaction(() => votingContract.methods.resetElection(), "platform ready for another election"));
document.getElementById("calculateButton").addEventListener("click", calculateCommitment);
document.getElementById("commitButton").addEventListener("click", submitCommitment);
document.getElementById("revealButton").addEventListener("click", revealVote);
document.getElementById("resultButton").addEventListener("click", viewResult);

updateWarnings();
