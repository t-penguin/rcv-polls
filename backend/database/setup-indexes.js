const db = require("./db");

/**
 * Sets up partial unique indexes for ballots to ensure:
 * - One vote per authenticated user per poll (pollId, userId) where userId IS NOT NULL
 * - One vote per guest per poll (pollId, guestId) where guestId IS NOT NULL
 *
 * These partial indexes are needed because userId and guestId are nullable,
 * and we only want to enforce uniqueness when they are not null.
 */
const setupPartialIndexes = async () => {
  try {
    const queryInterface = db.getQueryInterface();

    // Check if indexes already exist before creating
    const [results] = await db.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'ballots' 
      AND indexname IN ('unique_poll_user_partial', 'unique_poll_guest_partial')
    `);

    const existingIndexes = results.map((r) => r.indexname);

    // Create partial unique index for authenticated users (userId IS NOT NULL)
    if (!existingIndexes.includes("unique_poll_user_partial")) {
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX unique_poll_user_partial 
        ON ballots (poll_id, user_id) 
        WHERE user_id IS NOT NULL
      `);
      console.log("✅ Created partial unique index: unique_poll_user_partial");
    }

    // Create partial unique index for anonymous users (guestId IS NOT NULL)
    if (!existingIndexes.includes("unique_poll_guest_partial")) {
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX unique_poll_guest_partial 
        ON ballots (poll_id, guest_id) 
        WHERE guest_id IS NOT NULL
      `);
      console.log("✅ Created partial unique index: unique_poll_guest_partial");
    }

    console.log("✅ Partial unique indexes setup complete");
  } catch (error) {
    console.error("❌ Error setting up partial indexes:", error);
    throw error;
  }
};

module.exports = setupPartialIndexes;

