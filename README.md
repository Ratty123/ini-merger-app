# ini-merger-app
A simple, portable application for merging multiple engine.ini configuration files into a single combined file.


INI Merger Tool
A simple, portable application for merging multiple engine.ini configuration files into a single combined file.
Features

Merge multiple engine.ini files with intelligent conflict resolution
Proper handling of repeatable settings like Paths= entries
Preservation of comments from source files
Single executable file - no installation required

Download
Download the standalone executable from the Releases page.
Usage

Launch INIMerger.exe
Click "Add Files" to select your engine.ini files
Click "Start Merge Process"
Resolve any conflicts by choosing which value to keep
Click "Save Merged File" to save the result

Building from Source
Prerequisites

Node.js v14 or newer
npm (included with Node.js)

Setup

Clone the repository:
git clone https://github.com/yourusername/ini-merger.git
cd ini-merger

Install dependencies:
npm install

Install electron-builder:
npm install --save-dev electron-builder

Run in development mode:
npm start

Build portable executable:
npm run dist


The standalone executable will be created in the dist folder.
Technical Details
Built with:

Electron framework
JavaScript for INI parsing and merging
electron-builder for packaging

License
This project is licensed under the MIT License - see the LICENSE file for details.
