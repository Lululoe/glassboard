import express from 'express';
import { getSanitizedConfig } from '../config.js';

const router = express.Router();

router.get('/', (req, res) => {
    res.json(getSanitizedConfig());
});

export default router;
