const converter = require('../src/convert-to-pmtiles.cjs');
module.exports = converter;

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--all') || args.length === 0) {
    converter.convertAllOfflineTiles().catch(err => {
      console.error('Batch conversion error:', err);
      process.exit(1);
    });
  } else if (args.length >= 2) {
    converter.convertDirectoryToPmtiles({ inputDir: args[0], outputFile: args[1], type: args[2] || 'vector' })
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Conversion error:', err.message);
        process.exit(1);
      });
  } else {
    console.log('Usage: node scripts/convert-to-pmtiles.cjs [--all] | [<inputDir> <outputFile.pmtiles> [type]]');
    process.exit(1);
  }
}
