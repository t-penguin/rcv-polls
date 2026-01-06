const db = require("./db");
const User = require("./user");
const Poll = require("./poll");
const PollOption = require("./pollOption");
const Ballot = require("./ballot");
const BallotRanking = require("./ballotRanking");

// Define associations

// User -> Poll (creator relationship)
User.hasMany(Poll, { foreignKey: "creatorId", as: "createdPolls" });
Poll.belongsTo(User, { foreignKey: "creatorId", as: "creator" });

// Poll -> PollOption
Poll.hasMany(PollOption, { foreignKey: "pollId", as: "options" });
PollOption.belongsTo(Poll, { foreignKey: "pollId", as: "poll" });

// Poll -> Ballot
Poll.hasMany(Ballot, { foreignKey: "pollId", as: "ballots" });
Ballot.belongsTo(Poll, { foreignKey: "pollId", as: "poll" });

// User -> Ballot (nullable, for authenticated users)
User.hasMany(Ballot, { foreignKey: "userId", as: "ballots" });
Ballot.belongsTo(User, { foreignKey: "userId", as: "user" });

// Ballot -> BallotRanking
Ballot.hasMany(BallotRanking, { foreignKey: "ballotId", as: "rankings" });
BallotRanking.belongsTo(Ballot, { foreignKey: "ballotId", as: "ballot" });

// PollOption -> BallotRanking
PollOption.hasMany(BallotRanking, {
  foreignKey: "pollOptionId",
  as: "ballotRankings",
});
BallotRanking.belongsTo(PollOption, {
  foreignKey: "pollOptionId",
  as: "pollOption",
});

// Add unique constraints using indexes
// Note: Sequelize doesn't directly support partial unique indexes in model definitions,
// so we'll add them after sync or handle uniqueness in application logic

module.exports = {
  db,
  User,
  Poll,
  PollOption,
  Ballot,
  BallotRanking,
};
