import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/groups - Get all groups
router.get('/', async (req: Request, res: Response) => {
  try {
    const groups = await prisma.group.findMany({
      include: {
        userGroups: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const groupsWithUsers = groups.map(group => ({
      id: group.id,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      users: group.userGroups.map(ug => ug.user),
      memberCount: group.userGroups.length,
    }));

    res.json(groupsWithUsers);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// GET /api/groups/:id - Get group by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        userGroups: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const groupWithUsers = {
      id: group.id,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      users: group.userGroups.map(ug => ug.user),
      memberCount: group.userGroups.length,
    };

    res.json(groupWithUsers);
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// POST /api/groups - Create new group
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check if group already exists
    const existingGroup = await prisma.group.findUnique({
      where: { name },
    });

    if (existingGroup) {
      return res.status(409).json({ error: 'Group with this name already exists' });
    }

    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
      },
    });

    res.status(201).json({
      id: group.id,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      users: [],
      memberCount: 0,
    });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// PUT /api/groups/:id - Update group
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check if name is taken by another group
    const existingGroup = await prisma.group.findFirst({
      where: {
        name,
        NOT: { id },
      },
    });

    if (existingGroup) {
      return res.status(409).json({ error: 'Group with this name already exists' });
    }

    const group = await prisma.group.update({
      where: { id },
      data: {
        name,
        description: description || null,
      },
      include: {
        userGroups: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
    });

    res.json({
      id: group.id,
      name: group.name,
      description: group.description,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      users: group.userGroups.map(ug => ug.user),
      memberCount: group.userGroups.length,
    });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// DELETE /api/groups/:id - Delete group
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.group.delete({
      where: { id },
    });

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// POST /api/groups/:id/members - Add user to group
router.post('/:id/members', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if user is already in group
    const existingMembership = await prisma.userGroup.findFirst({
      where: {
        userId,
        groupId: id,
      },
    });

    if (existingMembership) {
      return res.status(409).json({ error: 'User is already a member of this group' });
    }

    await prisma.userGroup.create({
      data: {
        userId,
        groupId: id,
      },
    });

    res.status(201).json({ message: 'User added to group successfully' });
  } catch (error) {
    console.error('Error adding user to group:', error);
    res.status(500).json({ error: 'Failed to add user to group' });
  }
});

// DELETE /api/groups/:id/members/:userId - Remove user from group
router.delete('/:id/members/:userId', async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params;

    await prisma.userGroup.deleteMany({
      where: {
        userId,
        groupId: id,
      },
    });

    res.json({ message: 'User removed from group successfully' });
  } catch (error) {
    console.error('Error removing user from group:', error);
    res.status(500).json({ error: 'Failed to remove user from group' });
  }
});

export default router;
