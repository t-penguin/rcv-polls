const db = require("./db");
const {
  User,
  Poll,
  PollOption,
  Ballot,
  BallotRanking,
} = require("./index");
const setupPartialIndexes = require("./setup-indexes");
const crypto = require("crypto");

const seed = async () => {
  try {
    db.logging = false;
    await db.sync({ force: true }); // Drop and recreate tables

    // Set up partial unique indexes
    await setupPartialIndexes();

    // Create users
    const users = await User.bulkCreate([
      { username: "admin", passwordHash: User.hashPassword("admin123") },
      { username: "user1", passwordHash: User.hashPassword("user111") },
      { username: "user2", passwordHash: User.hashPassword("user222") },
      { username: "alice", passwordHash: User.hashPassword("alice123") },
      { username: "bob", passwordHash: User.hashPassword("bob123") },
    ]);

    console.log(`👤 Created ${users.length} users`);

    // Create polls with different statuses and configurations
    const polls = await Poll.bulkCreate([
      {
        title: "Best Programming Language 2024",
        description: "Vote for your favorite programming language",
        status: "open",
        creatorId: users[0].id, // admin
        allowAnonymous: true,
        maxRankings: 3,
      },
      {
        title: "Favorite Pizza Topping",
        description: "What's your top choice for pizza?",
        status: "closed",
        creatorId: users[1].id, // user1
        allowAnonymous: false,
        closedAt: new Date(),
      },
      {
        title: "Best Movie Genre",
        description: "Rank your favorite movie genres",
        status: "draft",
        creatorId: users[0].id, // admin
        allowAnonymous: true,
      },
      {
        title: "Team Building Activity",
        description: "What should we do for our next team event?",
        status: "open",
        creatorId: users[2].id, // user2
        allowAnonymous: true,
        maxRankings: 2,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
      {
        title: "Coffee Shop Location",
        description: "Where should we open our new coffee shop?",
        status: "open",
        creatorId: users[3].id, // alice
        allowAnonymous: false,
      },
    ]);

    console.log(`📊 Created ${polls.length} polls`);

    // Create poll options (at least 2 per poll)
    const pollOptions = await PollOption.bulkCreate([
      // Poll 1: Best Programming Language (5 options)
      { pollId: polls[0].id, text: "JavaScript", order: 1 },
      { pollId: polls[0].id, text: "Python", order: 2 },
      { pollId: polls[0].id, text: "TypeScript", order: 3 },
      { pollId: polls[0].id, text: "Rust", order: 4 },
      { pollId: polls[0].id, text: "Go", order: 5 },

      // Poll 2: Favorite Pizza Topping (4 options)
      { pollId: polls[1].id, text: "Pepperoni", order: 1 },
      { pollId: polls[1].id, text: "Mushrooms", order: 2 },
      { pollId: polls[1].id, text: "Extra Cheese", order: 3 },
      { pollId: polls[1].id, text: "Pineapple", order: 4 },

      // Poll 3: Best Movie Genre (3 options) - draft, no votes yet
      { pollId: polls[2].id, text: "Action", order: 1 },
      { pollId: polls[2].id, text: "Comedy", order: 2 },
      { pollId: polls[2].id, text: "Drama", order: 3 },

      // Poll 4: Team Building Activity (4 options)
      { pollId: polls[3].id, text: "Escape Room", order: 1 },
      { pollId: polls[3].id, text: "Bowling", order: 2 },
      { pollId: polls[3].id, text: "Hiking", order: 3 },
      { pollId: polls[3].id, text: "Cooking Class", order: 4 },

      // Poll 5: Coffee Shop Location (3 options)
      { pollId: polls[4].id, text: "Downtown", order: 1 },
      { pollId: polls[4].id, text: "University District", order: 2 },
      { pollId: polls[4].id, text: "Suburbs", order: 3 },
    ]);

    console.log(`✅ Created ${pollOptions.length} poll options`);

    // Create ballots (mix of authenticated and anonymous)
    const ballots = await Ballot.bulkCreate([
      // Poll 1: Best Programming Language - authenticated votes
      {
        pollId: polls[0].id,
        userId: users[1].id, // user1
        isAnonymous: false,
        submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      {
        pollId: polls[0].id,
        userId: users[2].id, // user2
        isAnonymous: false,
        submittedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      },
      {
        pollId: polls[0].id,
        userId: users[3].id, // alice
        isAnonymous: false,
        submittedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      },
      // Poll 1: Anonymous votes
      {
        pollId: polls[0].id,
        guestId: crypto.randomUUID(),
        isAnonymous: true,
        submittedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
      },
      {
        pollId: polls[0].id,
        guestId: crypto.randomUUID(),
        isAnonymous: true,
        submittedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
      },

      // Poll 2: Favorite Pizza Topping - closed poll with votes
      {
        pollId: polls[1].id,
        userId: users[0].id, // admin
        isAnonymous: false,
        submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      },
      {
        pollId: polls[1].id,
        userId: users[2].id, // user2
        isAnonymous: false,
        submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      },
      {
        pollId: polls[1].id,
        userId: users[4].id, // bob
        isAnonymous: false,
        submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },

      // Poll 4: Team Building Activity
      {
        pollId: polls[3].id,
        userId: users[1].id, // user1
        isAnonymous: false,
        submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        pollId: polls[3].id,
        guestId: crypto.randomUUID(),
        isAnonymous: true,
        submittedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      },

      // Poll 5: Coffee Shop Location (no anonymous allowed)
      {
        pollId: polls[4].id,
        userId: users[0].id, // admin
        isAnonymous: false,
        submittedAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      },
      {
        pollId: polls[4].id,
        userId: users[1].id, // user1
        isAnonymous: false,
        submittedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      },
    ]);

    console.log(`🗳️  Created ${ballots.length} ballots`);

    // Create ballot rankings
    // Poll 1 ballots (5 options available)
    const poll1Options = pollOptions.filter((opt) => opt.pollId === polls[0].id);
    const poll1Ballots = ballots.filter((b) => b.pollId === polls[0].id);

    // Ballot 1 (user1): JavaScript > TypeScript > Python
    await BallotRanking.bulkCreate([
      {
        ballotId: poll1Ballots[0].id,
        pollOptionId: poll1Options[0].id, // JavaScript
        rank: 1,
      },
      {
        ballotId: poll1Ballots[0].id,
        pollOptionId: poll1Options[2].id, // TypeScript
        rank: 2,
      },
      {
        ballotId: poll1Ballots[0].id,
        pollOptionId: poll1Options[1].id, // Python
        rank: 3,
      },
    ]);

    // Ballot 2 (user2): Python > Rust > Go > JavaScript
    await BallotRanking.bulkCreate([
      {
        ballotId: poll1Ballots[1].id,
        pollOptionId: poll1Options[1].id, // Python
        rank: 1,
      },
      {
        ballotId: poll1Ballots[1].id,
        pollOptionId: poll1Options[3].id, // Rust
        rank: 2,
      },
      {
        ballotId: poll1Ballots[1].id,
        pollOptionId: poll1Options[4].id, // Go
        rank: 3,
      },
      {
        ballotId: poll1Ballots[1].id,
        pollOptionId: poll1Options[0].id, // JavaScript
        rank: 4,
      },
    ]);

    // Ballot 3 (alice): TypeScript > JavaScript > Python
    await BallotRanking.bulkCreate([
      {
        ballotId: poll1Ballots[2].id,
        pollOptionId: poll1Options[2].id, // TypeScript
        rank: 1,
      },
      {
        ballotId: poll1Ballots[2].id,
        pollOptionId: poll1Options[0].id, // JavaScript
        rank: 2,
      },
      {
        ballotId: poll1Ballots[2].id,
        pollOptionId: poll1Options[1].id, // Python
        rank: 3,
      },
    ]);

    // Ballot 4 (anonymous): Rust > Go > TypeScript
    await BallotRanking.bulkCreate([
      {
        ballotId: poll1Ballots[3].id,
        pollOptionId: poll1Options[3].id, // Rust
        rank: 1,
      },
      {
        ballotId: poll1Ballots[3].id,
        pollOptionId: poll1Options[4].id, // Go
        rank: 2,
      },
      {
        ballotId: poll1Ballots[3].id,
        pollOptionId: poll1Options[2].id, // TypeScript
        rank: 3,
      },
    ]);

    // Ballot 5 (anonymous): Python > JavaScript
    await BallotRanking.bulkCreate([
      {
        ballotId: poll1Ballots[4].id,
        pollOptionId: poll1Options[1].id, // Python
        rank: 1,
      },
      {
        ballotId: poll1Ballots[4].id,
        pollOptionId: poll1Options[0].id, // JavaScript
        rank: 2,
      },
    ]);

    // Poll 2 ballots (4 options available)
    const poll2Options = pollOptions.filter((opt) => opt.pollId === polls[1].id);
    const poll2Ballots = ballots.filter((b) => b.pollId === polls[1].id);

    // Ballot 6 (admin): Pepperoni > Extra Cheese > Mushrooms
    await BallotRanking.bulkCreate([
      {
        ballotId: poll2Ballots[0].id,
        pollOptionId: poll2Options[0].id, // Pepperoni
        rank: 1,
      },
      {
        ballotId: poll2Ballots[0].id,
        pollOptionId: poll2Options[2].id, // Extra Cheese
        rank: 2,
      },
      {
        ballotId: poll2Ballots[0].id,
        pollOptionId: poll2Options[1].id, // Mushrooms
        rank: 3,
      },
    ]);

    // Ballot 7 (user2): Mushrooms > Pepperoni > Extra Cheese > Pineapple
    await BallotRanking.bulkCreate([
      {
        ballotId: poll2Ballots[1].id,
        pollOptionId: poll2Options[1].id, // Mushrooms
        rank: 1,
      },
      {
        ballotId: poll2Ballots[1].id,
        pollOptionId: poll2Options[0].id, // Pepperoni
        rank: 2,
      },
      {
        ballotId: poll2Ballots[1].id,
        pollOptionId: poll2Options[2].id, // Extra Cheese
        rank: 3,
      },
      {
        ballotId: poll2Ballots[1].id,
        pollOptionId: poll2Options[3].id, // Pineapple
        rank: 4,
      },
    ]);

    // Ballot 8 (bob): Extra Cheese > Pepperoni
    await BallotRanking.bulkCreate([
      {
        ballotId: poll2Ballots[2].id,
        pollOptionId: poll2Options[2].id, // Extra Cheese
        rank: 1,
      },
      {
        ballotId: poll2Ballots[2].id,
        pollOptionId: poll2Options[0].id, // Pepperoni
        rank: 2,
      },
    ]);

    // Poll 4 ballots (4 options available)
    const poll4Options = pollOptions.filter((opt) => opt.pollId === polls[3].id);
    const poll4Ballots = ballots.filter((b) => b.pollId === polls[3].id);

    // Ballot 9 (user1): Escape Room > Cooking Class
    await BallotRanking.bulkCreate([
      {
        ballotId: poll4Ballots[0].id,
        pollOptionId: poll4Options[0].id, // Escape Room
        rank: 1,
      },
      {
        ballotId: poll4Ballots[0].id,
        pollOptionId: poll4Options[3].id, // Cooking Class
        rank: 2,
      },
    ]);

    // Ballot 10 (anonymous): Hiking > Bowling > Escape Room
    await BallotRanking.bulkCreate([
      {
        ballotId: poll4Ballots[1].id,
        pollOptionId: poll4Options[2].id, // Hiking
        rank: 1,
      },
      {
        ballotId: poll4Ballots[1].id,
        pollOptionId: poll4Options[1].id, // Bowling
        rank: 2,
      },
      {
        ballotId: poll4Ballots[1].id,
        pollOptionId: poll4Options[0].id, // Escape Room
        rank: 3,
      },
    ]);

    // Poll 5 ballots (3 options available)
    const poll5Options = pollOptions.filter((opt) => opt.pollId === polls[4].id);
    const poll5Ballots = ballots.filter((b) => b.pollId === polls[4].id);

    // Ballot 11 (admin): Downtown > University District > Suburbs
    await BallotRanking.bulkCreate([
      {
        ballotId: poll5Ballots[0].id,
        pollOptionId: poll5Options[0].id, // Downtown
        rank: 1,
      },
      {
        ballotId: poll5Ballots[0].id,
        pollOptionId: poll5Options[1].id, // University District
        rank: 2,
      },
      {
        ballotId: poll5Ballots[0].id,
        pollOptionId: poll5Options[2].id, // Suburbs
        rank: 3,
      },
    ]);

    // Ballot 12 (user1): University District > Downtown
    await BallotRanking.bulkCreate([
      {
        ballotId: poll5Ballots[1].id,
        pollOptionId: poll5Options[1].id, // University District
        rank: 1,
      },
      {
        ballotId: poll5Ballots[1].id,
        pollOptionId: poll5Options[0].id, // Downtown
        rank: 2,
      },
    ]);

    // Count total rankings created
    const totalRankings = await BallotRanking.count();
    console.log(`📋 Created ${totalRankings} ballot rankings`);

    console.log("🌱 Seeded the database");
    console.log("\n📊 Seed Data Summary:");
    console.log(`   - ${users.length} users`);
    console.log(`   - ${polls.length} polls (${polls.filter((p) => p.status === "draft").length} draft, ${polls.filter((p) => p.status === "open").length} open, ${polls.filter((p) => p.status === "closed").length} closed)`);
    console.log(`   - ${pollOptions.length} poll options`);
    console.log(`   - ${ballots.length} ballots (${ballots.filter((b) => !b.isAnonymous).length} authenticated, ${ballots.filter((b) => b.isAnonymous).length} anonymous)`);
    console.log(`   - ${totalRankings} ballot rankings`);
  } catch (error) {
    console.error("Error seeding database:", error);
    if (error.message.includes("does not exist")) {
      console.log("\n🤔🤔🤔 Have you created your database??? 🤔🤔🤔");
    }
  }
  db.close();
};

seed();
