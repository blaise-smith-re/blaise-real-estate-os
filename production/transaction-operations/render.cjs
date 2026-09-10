// Reuse the approved local-only print/phone renderer unchanged.
const fs=require('fs'),path=require('path');
const bundled=path.join(__dirname,'shared','render.cjs');
require(fs.existsSync(bundled)?bundled:path.join(__dirname,'..','showing-tour','render.cjs'));
