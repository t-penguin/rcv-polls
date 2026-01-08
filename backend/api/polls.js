const express = require("express");
const router = express.Router();
const { Poll, PollOption, User, Ballot, BallotRanking } = require("../database");
const { authenticateJWT } = require("../auth");
const crypto = require("crypto");

// GET /api/polls - Get all polls (with optional query params)
router.get("/", async (req, res) => {
  try {
    const { status, creatorId } = req.query;
    const where = {};

    if (status) {
      where.status = status;
    }
    if (creatorId) {
      where.creatorId = creatorId;
    }

    const polls = await Poll.findAll({
      where,
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username"],
        },
        {
          model: PollOption,
          as: "options",
          attributes: ["id", "text", "order", "imageUrl"],
          order: [["order", "ASC"]],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(polls);
  } catch (error) {
    console.error("Error fetching polls:", error);
    res.status(500).json({ error: "Failed to fetch polls" });
  }
});

// GET /api/polls/link/:shareableLink - Get poll by shareable link
router.get("/link/:shareableLink", async (req, res) => {
  try {
    const poll = await Poll.findOne({
      where: { shareableLink: req.params.shareableLink },
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username"],
        },
        {
          model: PollOption,
          as: "options",
          attributes: ["id", "text", "order", "imageUrl"],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!poll) {
      return res.status(404).json({ error: "Poll not found" });
    }

    res.json(poll);
  } catch (error) {
    console.error("Error fetching poll by link:", error);
    res.status(500).json({ error: "Failed to fetch poll" });
  }
});

// GET /api/polls/:id - Get a single poll by ID
router.get("/:id", async (req, res) => {
  try {
    const poll = await Poll.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username"],
        },
        {
          model: PollOption,
          as: "options",
          attributes: ["id", "text", "order", "imageUrl"],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!poll) {
      return res.status(404).json({ error: "Poll not found" });
    }

    res.json(poll);
  } catch (error) {
    console.error("Error fetching poll:", error);
    res.status(500).json({ error: "Failed to fetch poll" });
  }
});

// POST /api/polls - Create a new poll (authenticated)
router.post("/", authenticateJWT, async (req, res) => {
  try {
    const { title, description, options, allowAnonymous, maxRankings, expiresAt } =
      req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    if (!options || !Array.isArray(options) || options.length < 2) {
      return res
        .status(400)
        .json({ error: "At least 2 poll options are required" });
    }

    // Validate each option has text
    for (const option of options) {
      if (!option.text || !option.text.trim()) {
        return res
          .status(400)
          .json({ error: "All poll options must have text" });
      }
    }

    // Create poll
    const poll = await Poll.create({
      title: title.trim(),
      description: description?.trim() || null,
      creatorId: req.user.id,
      status: "draft",
      allowAnonymous: allowAnonymous || false,
      maxRankings: maxRankings || null,
      expiresAt: expiresAt || null,
    });

    // Create poll options
    const pollOptions = await Promise.all(
      options.map((option, index) =>
        PollOption.create({
          pollId: poll.id,
          text: option.text.trim(),
          order: option.order !== undefined ? option.order : index,
          imageUrl: option.imageUrl || null,
        })
      )
    );

    // Fetch the created poll with associations
    const createdPoll = await Poll.findByPk(poll.id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username"],
        },
        {
          model: PollOption,
          as: "options",
          attributes: ["id", "text", "order", "imageUrl"],
          order: [["order", "ASC"]],
        },
      ],
    });

    res.status(201).json(createdPoll);
  } catch (error) {
    console.error("Error creating poll:", error);
    res.status(500).json({ error: "Failed to create poll" });
  }
});

// PUT /api/polls/:id - Update a poll (authenticated, only creator)
router.put("/:id", authenticateJWT, async (req, res) => {
  try {
    const poll = await Poll.findByPk(req.params.id);

    if (!poll) {
      return res.status(404).json({ error: "Poll not found" });
    }

    // Check if user is the creator
    if (poll.creatorId !== req.user.id) {
      return res.status(403).json({ error: "Only the poll creator can update this poll" });
    }

    // Don't allow updating if poll is closed
    if (poll.status === "closed") {
      return res
        .status(400)
        .json({ error: "Cannot update a closed poll" });
    }

    const { title, description, options, allowAnonymous, maxRankings, expiresAt, status } =
      req.body;

    // Update poll fields
    if (title !== undefined) {
      if (!title || !title.trim()) {
        return res.status(400).json({ error: "Title cannot be empty" });
      }
      poll.title = title.trim();
    }

    if (description !== undefined) {
      poll.description = description?.trim() || null;
    }

    if (allowAnonymous !== undefined) {
      poll.allowAnonymous = allowAnonymous;
    }

    if (maxRankings !== undefined) {
      poll.maxRankings = maxRankings || null;
    }

    if (expiresAt !== undefined) {
      poll.expiresAt = expiresAt || null;
    }

    // Update status if provided
    if (status !== undefined) {
      if (!["draft", "open", "closed"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      // If closing the poll, set closedAt
      if (status === "closed" && poll.status !== "closed") {
        poll.closedAt = new Date();
      }
      
      poll.status = status;
    }

    // Update options if provided
    if (options !== undefined) {
      if (!Array.isArray(options) || options.length < 2) {
        return res
          .status(400)
          .json({ error: "At least 2 poll options are required" });
      }

      // Validate each option has text
      for (const option of options) {
        if (!option.text || !option.text.trim()) {
          return res
            .status(400)
            .json({ error: "All poll options must have text" });
        }
      }

      // Don't allow updating options if poll is open or closed (has votes)
      if (poll.status === "open" || poll.status === "closed") {
        return res
          .status(400)
          .json({ error: "Cannot update options for an open or closed poll" });
      }

      // Delete existing options
      await PollOption.destroy({ where: { pollId: poll.id } });

      // Create new options
      await Promise.all(
        options.map((option, index) =>
          PollOption.create({
            pollId: poll.id,
            text: option.text.trim(),
            order: option.order !== undefined ? option.order : index,
            imageUrl: option.imageUrl || null,
          })
        )
      );
    }

    await poll.save();

    // Fetch updated poll with associations
    const updatedPoll = await Poll.findByPk(poll.id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username"],
        },
        {
          model: PollOption,
          as: "options",
          attributes: ["id", "text", "order", "imageUrl"],
          order: [["order", "ASC"]],
        },
      ],
    });

    res.json(updatedPoll);
  } catch (error) {
    console.error("Error updating poll:", error);
    res.status(500).json({ error: "Failed to update poll" });
  }
});

// DELETE /api/polls/:id - Delete a poll (authenticated, only creator)
router.delete("/:id", authenticateJWT, async (req, res) => {
  try {
    const poll = await Poll.findByPk(req.params.id);

    if (!poll) {
      return res.status(404).json({ error: "Poll not found" });
    }

    // Check if user is the creator
    if (poll.creatorId !== req.user.id) {
      return res.status(403).json({ error: "Only the poll creator can delete this poll" });
    }

    // Delete poll (cascade will delete options, ballots, and rankings)
    await poll.destroy();

    res.json({ message: "Poll deleted successfully" });
  } catch (error) {
    console.error("Error deleting poll:", error);
    res.status(500).json({ error: "Failed to delete poll" });
  }
});

// GET /api/polls/:pollId/ballot - Check if user/guest has voted
router.get("/:pollId/ballot", async (req, res) => {
  try {
    const poll = await Poll.findByPk(req.params.pollId);
    if (!poll) {
      return res.status(404).json({ error: "Poll not found" });
    }

    // Check for authenticated user ballot
    const token = req.cookies.token;
    let userId = null;
    
    if (token) {
      try {
        const jwt = require("jsonwebtoken");
        const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        // Invalid token, continue as guest
      }
    }

    // Check for guest ballot
    const guestId = req.query.guestId || null;

    let ballot = null;

    // Try to find existing ballot
    if (userId) {
      ballot = await Ballot.findOne({
        where: { pollId: poll.id, userId },
        include: [
          {
            model: BallotRanking,
            as: "rankings",
            include: [
              {
                model: PollOption,
                as: "pollOption",
                attributes: ["id", "text", "order", "imageUrl"],
              },
            ],
            order: [["rank", "ASC"]],
          },
        ],
      });
    } else if (guestId) {
      ballot = await Ballot.findOne({
        where: { pollId: poll.id, guestId },
        include: [
          {
            model: BallotRanking,
            as: "rankings",
            include: [
              {
                model: PollOption,
                as: "pollOption",
                attributes: ["id", "text", "order", "imageUrl"],
              },
            ],
            order: [["rank", "ASC"]],
          },
        ],
      });
    }

    if (!ballot) {
      return res.json({ hasVoted: false, ballot: null });
    }

    res.json({ hasVoted: true, ballot });
  } catch (error) {
    console.error("Error checking ballot:", error);
    res.status(500).json({ error: "Failed to check ballot" });
  }
});

// POST /api/polls/:pollId/ballot - Submit a ballot
router.post("/:pollId/ballot", async (req, res) => {
  try {
    const poll = await Poll.findByPk(req.params.pollId, {
      include: [
        {
          model: PollOption,
          as: "options",
        },
      ],
    });

    if (!poll) {
      return res.status(404).json({ error: "Poll not found" });
    }

    // Validate poll is open
    if (poll.status !== "open") {
      return res.status(400).json({ error: "Poll is not open for voting" });
    }

    // Check if poll has expired
    if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) {
      return res.status(400).json({ error: "Poll has expired" });
    }

    const { rankings } = req.body; // Array of { pollOptionId, rank }

    // Validation
    if (!rankings || !Array.isArray(rankings) || rankings.length === 0) {
      return res.status(400).json({ error: "At least one ranking is required" });
    }

    // Validate rankings are sequential starting from 1 (no gaps)
    const sortedRanks = rankings.map((r) => r.rank).sort((a, b) => a - b);
    for (let i = 0; i < sortedRanks.length; i++) {
      if (sortedRanks[i] !== i + 1) {
        return res.status(400).json({
          error: "Rankings must be sequential starting from 1 (no gaps allowed)",
        });
      }
    }

    // Validate no duplicate ranks
    const rankSet = new Set(sortedRanks);
    if (rankSet.size !== sortedRanks.length) {
      return res.status(400).json({ error: "Duplicate ranks are not allowed" });
    }

    // Validate no duplicate options
    const optionIds = rankings.map((r) => r.pollOptionId);
    const optionSet = new Set(optionIds);
    if (optionSet.size !== optionIds.length) {
      return res.status(400).json({ error: "Duplicate options are not allowed" });
    }

    // Validate all option IDs belong to this poll
    const pollOptionIds = new Set(poll.options.map((opt) => opt.id));
    for (const ranking of rankings) {
      if (!pollOptionIds.has(ranking.pollOptionId)) {
        return res.status(400).json({
          error: `Option ${ranking.pollOptionId} does not belong to this poll`,
        });
      }
    }

    // Validate maxRankings if set
    if (poll.maxRankings && rankings.length > poll.maxRankings) {
      return res
        .status(400)
        .json({ error: `Maximum ${poll.maxRankings} rankings allowed` });
    }

    // Determine userId or guestId
    const token = req.cookies.token;
    let userId = null;
    let guestId = null;

    if (token) {
      try {
        const jwt = require("jsonwebtoken");
        const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        // Invalid token, continue as guest
      }
    }

    // If no userId and anonymous voting not allowed, require authentication
    if (!userId && !poll.allowAnonymous) {
      return res.status(401).json({ error: "Authentication required to vote in this poll" });
    }

    // If no userId, use guestId
    if (!userId) {
      guestId = req.body.guestId || crypto.randomUUID();
      if (!guestId) {
        return res.status(400).json({ error: "guestId is required for anonymous voting" });
      }
    }

    // Check if user/guest has already voted
    let existingBallot = null;
    if (userId) {
      existingBallot = await Ballot.findOne({
        where: { pollId: poll.id, userId },
      });
    } else {
      existingBallot = await Ballot.findOne({
        where: { pollId: poll.id, guestId },
      });
    }

    if (existingBallot) {
      return res.status(409).json({ error: "You have already voted in this poll" });
    }

    // Create ballot
    const ballot = await Ballot.create({
      pollId: poll.id,
      userId,
      guestId,
      isAnonymous: !!guestId,
    });

    // Create ballot rankings
    await Promise.all(
      rankings.map((ranking) =>
        BallotRanking.create({
          ballotId: ballot.id,
          pollOptionId: ranking.pollOptionId,
          rank: ranking.rank,
        })
      )
    );

    // Fetch created ballot with rankings
    const createdBallot = await Ballot.findByPk(ballot.id, {
      include: [
        {
          model: BallotRanking,
          as: "rankings",
          include: [
            {
              model: PollOption,
              as: "pollOption",
              attributes: ["id", "text", "order", "imageUrl"],
            },
          ],
          order: [["rank", "ASC"]],
        },
      ],
    });

    res.status(201).json({
      message: "Ballot submitted successfully",
      ballot: createdBallot,
      guestId: guestId, // Return guestId for anonymous voters to store
    });
  } catch (error) {
    console.error("Error submitting ballot:", error);
    
    // Handle unique constraint violations
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "You have already voted in this poll" });
    }
    
    res.status(500).json({ error: "Failed to submit ballot" });
  }
});

module.exports = router;

