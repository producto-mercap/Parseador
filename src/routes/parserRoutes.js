const express = require('express');
const router = express.Router();
const parserController = require('../controllers/parserController');
const ParserDB = require('../models/ParserDB');

router.get('/', parserController.getIndex);
router.post('/parser', parserController.createParser);
router.delete('/parser/:id', parserController.deleteParser);
router.post('/parse', parserController.parseFile);
router.post('/parse/manual', parserController.parseManual);
router.get('/parser/:id', parserController.getParser);
router.put('/parser/:id', parserController.updateParser);

// Agregar esta ruta para debug
router.get('/debug/parsers', async (req, res) => {
    try {
        const parsers = await ParserDB.getAll();
        res.json({
            success: true,
            count: parsers.length,
            parsers: parsers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router; 