// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SecureVoting {

    // stores the address which deployed the contract
    address private admin;

    // stores whether the platform is ready for another election
    bool private readyForNewElection;

    // stores the id of the current election
    uint private currentElectionId;

    // represents each stage of an election
    enum Phase {
        Setup,
        Voting,
        Reveal,
        Finalised
    }

    // stores the main information for one election
    struct Election {
        string topic;
        string[] options;
        uint[] voteCounts;
        Phase currentPhase;
        bool exists;
        uint numberCommitted;
        uint numberRevealed;
        address[] voterList;
        mapping(address => bool) knownVoter;
        mapping(address => bool) eligibleVoter;
        mapping(address => bytes32) commitment;
        mapping(address => bool) hasCommitted;
        mapping(address => bool) hasRevealed;
    }

    // maps each election id to its election data
    mapping(uint => Election) private elections;

    // records important actions in transaction logs
    event ElectionPrepared(uint electionId, string topic);
    event VoterAdded(uint electionId, address voter);
    event VoterRemoved(uint electionId, address voter);
    event VotingStarted(uint electionId);
    event VoteCommitted(uint electionId, address voter, bytes32 commitment);
    event VotingEnded(uint electionId);
    event VoteRevealed(
        uint electionId,
        address voter,
        uint optionIndex,
        bytes32 matchedCommitment
    );
    event ElectionFinalised(uint electionId);
    event ElectionReset(uint electionId);

    // allows only the admin to call a function
    modifier adminOnly() {
        require(msg.sender == admin, "only the admin can call this function");
        _;
    }

    // checks that the current election exists
    modifier electionExists() {
        require(
            elections[currentElectionId].exists,
            "an election has not been prepared"
        );
        _;
    }

    // checks that the current election is in the required phase
    modifier duringPhase(Phase requiredPhase) {
        require(
            elections[currentElectionId].currentPhase == requiredPhase,
            "this action is not available in the current phase"
        );
        _;
    }

    // makes the deployer the admin
    constructor() {
        admin = msg.sender;
        readyForNewElection = true;
    }

    // prepares an election topic and its voting options
    function prepareElection(
        string memory topic,
        string[] memory optionList
    ) public adminOnly {
        require(
            readyForNewElection,
            "reset the finalised election before preparing another election"
        );
        require(bytes(topic).length > 0, "the election topic cannot be empty");
        require(optionList.length >= 2, "at least two options are required");

        currentElectionId += 1;
        Election storage election = elections[currentElectionId];

        election.topic = topic;
        election.currentPhase = Phase.Setup;
        election.exists = true;

        for (uint i = 0; i < optionList.length; i++) {
            require(
                bytes(optionList[i]).length > 0,
                "an option cannot contain empty text"
            );

            election.options.push(optionList[i]);
            election.voteCounts.push(0);
        }

        readyForNewElection = false;

        emit ElectionPrepared(currentElectionId, topic);
    }

    // adds an address to the eligible voter list during setup
    function addEligibleVoter(address voter)
        public
        adminOnly
        electionExists
        duringPhase(Phase.Setup)
    {
        require(voter != address(0), "the voter address cannot be zero");
        require(voter != admin, "the admin cannot be a voter");

        Election storage election = elections[currentElectionId];

        require(
            !election.eligibleVoter[voter],
            "this address is already an eligible voter"
        );

        if (!election.knownVoter[voter]) {
            election.voterList.push(voter);
            election.knownVoter[voter] = true;
        }

        election.eligibleVoter[voter] = true;

        emit VoterAdded(currentElectionId, voter);
    }

    // removes an address from the eligible voter list during setup
    function removeEligibleVoter(address voter)
        public
        adminOnly
        electionExists
        duringPhase(Phase.Setup)
    {
        Election storage election = elections[currentElectionId];

        require(
            election.eligibleVoter[voter],
            "this address is not an eligible voter"
        );

        election.eligibleVoter[voter] = false;

        emit VoterRemoved(currentElectionId, voter);
    }

    // starts commitment voting after setup is complete
    function startVoting()
        public
        adminOnly
        electionExists
        duringPhase(Phase.Setup)
    {
        require(
            getEligibleVoters().length > 0,
            "at least one eligible voter is required"
        );

        elections[currentElectionId].currentPhase = Phase.Voting;

        emit VotingStarted(currentElectionId);
    }

    // stores one hidden commitment from an eligible voter
    function commitVote(bytes32 hiddenVote)
        public
        electionExists
        duringPhase(Phase.Voting)
    {
        Election storage election = elections[currentElectionId];

        require(msg.sender != admin, "the admin cannot vote");
        require(
            election.eligibleVoter[msg.sender],
            "you are not eligible for this election"
        );
        require(
            !election.hasCommitted[msg.sender],
            "you have already submitted a commitment"
        );
        require(hiddenVote != bytes32(0), "the commitment cannot be empty");

        election.commitment[msg.sender] = hiddenVote;
        election.hasCommitted[msg.sender] = true;
        election.numberCommitted += 1;

        emit VoteCommitted(currentElectionId, msg.sender, hiddenVote);
    }

    // ends commitment voting and begins the reveal phase
    function endVoting()
        public
        adminOnly
        electionExists
        duringPhase(Phase.Voting)
    {
        elections[currentElectionId].currentPhase = Phase.Reveal;

        emit VotingEnded(currentElectionId);
    }

    // checks a revealed option and secret against the stored commitment
    function revealVote(uint optionIndex, string memory secret)
        public
        electionExists
        duringPhase(Phase.Reveal)
    {
        Election storage election = elections[currentElectionId];

        require(
            election.eligibleVoter[msg.sender],
            "you are not eligible for this election"
        );
        require(
            election.hasCommitted[msg.sender],
            "you did not submit a commitment"
        );
        require(
            !election.hasRevealed[msg.sender],
            "you have already revealed your vote"
        );
        require(
            optionIndex < election.options.length,
            "the selected option is invalid"
        );
        require(bytes(secret).length > 0, "the secret cannot be empty");

        bytes32 revealedCommitment = keccak256(
            abi.encodePacked(
                currentElectionId,
                msg.sender,
                optionIndex,
                secret
            )
        );

        require(
            revealedCommitment == election.commitment[msg.sender],
            "the option and secret do not match your commitment"
        );

        election.hasRevealed[msg.sender] = true;
        election.voteCounts[optionIndex] += 1;
        election.numberRevealed += 1;

        emit VoteRevealed(
            currentElectionId,
            msg.sender,
            optionIndex,
            revealedCommitment
        );
    }

    // finalises the election and makes the result available
    function finaliseElection()
        public
        adminOnly
        electionExists
        duringPhase(Phase.Reveal)
    {
        elections[currentElectionId].currentPhase = Phase.Finalised;

        emit ElectionFinalised(currentElectionId);
    }

    // allows another election to be prepared without deleting old results
    function resetElection()
        public
        adminOnly
        electionExists
        duringPhase(Phase.Finalised)
    {
        require(
            !readyForNewElection,
            "the platform is already ready for another election"
        );

        readyForNewElection = true;

        emit ElectionReset(currentElectionId);
    }

    // returns the admin address
    function getAdmin() public view returns (address) {
        return admin;
    }

    // returns the current election id
    function getCurrentElectionId() public view returns (uint) {
        return currentElectionId;
    }

    // returns whether another election can be prepared
    function canPrepareElection() public view returns (bool) {
        return readyForNewElection;
    }

    // returns the topic and phase for an election
    function getElectionInformation(uint electionId)
        public
        view
        returns (string memory, Phase)
    {
        require(elections[electionId].exists, "this election does not exist");

        Election storage election = elections[electionId];

        return (election.topic, election.currentPhase);
    }

    // returns the option text without exposing vote counts
    function getElectionOptions(uint electionId)
        public
        view
        returns (string[] memory)
    {
        require(elections[electionId].exists, "this election does not exist");

        return elections[electionId].options;
    }

    // returns all currently eligible addresses for the current election
    function getEligibleVoters()
        public
        view
        adminOnly
        returns (address[] memory)
    {
        Election storage election = elections[currentElectionId];
        uint eligibleCount = 0;

        for (uint i = 0; i < election.voterList.length; i++) {
            if (election.eligibleVoter[election.voterList[i]]) {
                eligibleCount += 1;
            }
        }

        address[] memory eligibleList = new address[](eligibleCount);
        uint listIndex = 0;

        for (uint i = 0; i < election.voterList.length; i++) {
            if (election.eligibleVoter[election.voterList[i]]) {
                eligibleList[listIndex] = election.voterList[i];
                listIndex += 1;
            }
        }

        return eligibleList;
    }

    // returns the caller's status for the current election
    function getMyVotingStatus()
        public
        view
        electionExists
        returns (bool, bool, bool)
    {
        Election storage election = elections[currentElectionId];

        return (
            election.eligibleVoter[msg.sender],
            election.hasCommitted[msg.sender],
            election.hasRevealed[msg.sender]
        );
    }

    // calculates a commitment without storing the option or secret on-chain
    function calculateCommitment(
        uint electionId,
        uint optionIndex,
        string memory secret
    ) public view returns (bytes32) {
        require(elections[electionId].exists, "this election does not exist");
        require(
            optionIndex < elections[electionId].options.length,
            "the selected option is invalid"
        );
        require(bytes(secret).length > 0, "the secret cannot be empty");

        return keccak256(
            abi.encodePacked(
                electionId,
                msg.sender,
                optionIndex,
                secret
            )
        );
    }

    // allows the admin to check a voter's status without seeing their choice
    function getVoterStatus(address voter)
        public
        view
        adminOnly
        electionExists
        returns (bool, bool, bool)
    {
        Election storage election = elections[currentElectionId];

        return (
            election.eligibleVoter[voter],
            election.hasCommitted[voter],
            election.hasRevealed[voter]
        );
    }

    // returns the number of commitments and valid reveals
    function getParticipationTotals(uint electionId)
        public
        view
        returns (uint, uint)
    {
        require(elections[electionId].exists, "this election does not exist");

        Election storage election = elections[electionId];

        return (election.numberCommitted, election.numberRevealed);
    }

    // returns final option counts after the election is finalised
    function getResults(uint electionId)
        public
        view
        returns (string[] memory, uint[] memory)
    {
        require(elections[electionId].exists, "this election does not exist");
        require(
            elections[electionId].currentPhase == Phase.Finalised,
            "the election result has not been finalised"
        );

        Election storage election = elections[electionId];

        return (election.options, election.voteCounts);
    }

    // returns all winning options after finalisation
    function getWinners(uint electionId)
        public
        view
        returns (string[] memory)
    {
        require(elections[electionId].exists, "this election does not exist");
        require(
            elections[electionId].currentPhase == Phase.Finalised,
            "the election result has not been finalised"
        );

        Election storage election = elections[electionId];
        uint highestVotes = 0;

        for (uint i = 0; i < election.voteCounts.length; i++) {
            if (election.voteCounts[i] > highestVotes) {
                highestVotes = election.voteCounts[i];
            }
        }

        if (highestVotes == 0) {
            return new string[](0);
        }

        uint winnerCount = 0;

        for (uint i = 0; i < election.voteCounts.length; i++) {
            if (election.voteCounts[i] == highestVotes) {
                winnerCount += 1;
            }
        }

        string[] memory winners = new string[](winnerCount);
        uint winnerIndex = 0;

        for (uint i = 0; i < election.voteCounts.length; i++) {
            if (election.voteCounts[i] == highestVotes) {
                winners[winnerIndex] = election.options[i];
                winnerIndex += 1;
            }
        }

        return winners;
    }
}
