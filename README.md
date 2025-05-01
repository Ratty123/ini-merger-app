# INI Merger Tool

A simple, portable application for merging multiple engine.ini configuration files into a single combined file.

![image](https://github.com/user-attachments/assets/f6036509-c805-4597-8843-8be76572740d)

## Features
* Merge multiple engine.ini files with intelligent conflict resolution
* Proper handling of repeatable settings like `Paths=` entries
* Preservation of comments from source files
* Single executable file - no installation required

## Building from Source

### Prerequisites
* Node.js v14 or newer
* npm (included with Node.js)

### Required Files
You need these specific files in your project directory:
* `package.json` - Contains project configuration
* `main.js` - The main Electron process
* `index.html` - The application user interface
* `renderer.js` - UI logic and merging functionality

### Setup

**1. Create a project directory:**
* mkdir ini-merger-app
* cd ini-merger-app

**2. Create the four required files with correct content:**
* Copy the code for each file as provided in the instructions

**3. Install dependencies:**
* npm install
  
**4. Install electron-builder:**
* npm install --save-dev electron-builder
  
**5. Run in development mode:**
* npm start
  
**6. Build portable executable:**
* npm run dist

The standalone executable will be created in the `dist` folder.

## Usage

**Launch INIMerger.exe**
* Click "Add Files" to select your engine.ini files
* Click "Start Merge Process"
* Resolve any conflicts by choosing which value to keep
* Click "Save Merged File" to save the result


## Technical Details

**Built with:**
* Electron framework
* JavaScript for INI parsing and merging
* electron-builder for packaging

## License
This project is licensed under the MIT License - see the LICENSE file for details.
