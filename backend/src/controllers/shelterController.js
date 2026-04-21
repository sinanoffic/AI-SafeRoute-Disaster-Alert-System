const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SEED_SHELTERS = [
    { name: 'Government High School', type: 'School',         lat: 12.9780, lng: 77.5900, capacity: 200 },
    { name: 'City Community Hall',    type: 'Hall',           lat: 12.9650, lng: 77.6010, capacity: 350 },
    { name: 'District General Hospital', type: 'Hospital',    lat: 12.9690, lng: 77.5850, capacity: 800 },
    { name: 'Public Library Center',  type: 'Public',         lat: 12.9750, lng: 77.6050, capacity: 120 },
    { name: 'Municipal Sports Complex', type: 'Hall',         lat: 12.9820, lng: 77.5980, capacity: 600 },
    { name: 'St. Mary’s College',     type: 'School',         lat: 12.9850, lng: 77.5880, capacity: 450 },
    { name: 'Metro Health Center',    type: 'Hospital',       lat: 12.9580, lng: 77.5950, capacity: 150 },
    { name: 'Heritage Town Hall',     type: 'Hall',           lat: 12.9720, lng: 77.6150, capacity: 500 },
    { name: 'State Primary School',   type: 'School',         lat: 12.9920, lng: 77.6020, capacity: 180 },
    { name: 'Civic Plaza Hall',      type: 'Hall',           lat: 12.9620, lng: 77.5750, capacity: 400 },
    { name: 'Central Hospital (ER)', type: 'Hospital',       lat: 12.9890, lng: 77.5780, capacity: 900 },
    { name: 'Unity Hall Center',     type: 'Hall',           lat: 12.9750, lng: 77.5700, capacity: 250 },
];

exports.getShelters = async (req, res) => {
    try {
        const shelters = await prisma.shelter.findMany({
            where: { isActive: true }
        });
        res.json(shelters);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.seedShelters = async (req, res) => {
    try {
        await prisma.shelter.createMany({
            data: SEED_SHELTERS
        });
        res.json({ message: "Shelters seeded successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
