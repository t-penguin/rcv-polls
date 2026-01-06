const express = require("express");
const router = express.Router();
const { Poll, PollOption, User } = require("../database");
const { authenticateJWT } = require("../auth");

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

module.exports = router;

