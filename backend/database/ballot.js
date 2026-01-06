const { DataTypes } = require("sequelize");
const db = require("./db");

const Ballot = db.define(
  "ballot",
  {
    guestId: {
      type: DataTypes.STRING,
      allowNull: true,
      // guestId is used for anonymous voting to prevent duplicate votes
      // Should be a unique identifier like a session ID or generated UUID
    },
    isAnonymous: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    indexes: [
      // Note: Partial unique indexes for (pollId, userId) and (pollId, guestId)
      // need to be created manually via raw SQL after sync, as Sequelize doesn't
      // support partial indexes directly. See database/setup-indexes.js
      // For now, uniqueness is enforced in application logic
    ],
  }
);

// Add validation to ensure either userId or guestId is present
Ballot.beforeValidate((ballot) => {
  if (!ballot.userId && !ballot.guestId) {
    throw new Error("Ballot must have either userId or guestId");
  }
  if (ballot.userId && ballot.guestId) {
    throw new Error("Ballot cannot have both userId and guestId");
  }
  if (ballot.guestId) {
    ballot.isAnonymous = true;
  }
});

// Associations will be set up in database/index.js to avoid circular dependencies

module.exports = Ballot;

