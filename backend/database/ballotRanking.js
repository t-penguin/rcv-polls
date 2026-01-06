const { DataTypes } = require("sequelize");
const db = require("./db");

const BallotRanking = db.define(
  "ballotRanking",
  {
    rank: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
      // rank represents the preference: 1 = first choice, 2 = second choice, etc.
    },
  },
  {
    indexes: [
      // Ensure no duplicate ranks within a single ballot
      {
        unique: true,
        fields: ["ballotId", "rank"],
        name: "unique_ballot_rank",
      },
      // Ensure no duplicate options within a single ballot
      {
        unique: true,
        fields: ["ballotId", "pollOptionId"],
        name: "unique_ballot_option",
      },
    ],
  }
);

// Associations will be set up in database/index.js to avoid circular dependencies

module.exports = BallotRanking;

