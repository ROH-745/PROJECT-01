	const { app, BrowserWindow } = require('electron');
	const url=require('url');
	const path=require('path');

	let mainWindow;

function createMainWindow() {
	    mainWindow=new BrowserWindow({
	        title:'Food order App',
	        width:1500,
	        height:800,
	        webPreferences: {
	            contextIsolation:true,
	            nodeIntegration:true,
	        },
	    });
	
	    mainWindow.webContents.openDevTools();
	
	    const startUrl=url.format({
	        pathname:path.join(__dirname, '../build/index.html'),
	        protocol:'file',
	    });
	    mainWindow.loadURL(startUrl);
	    
};
	app.whenReady().then(() => {
	    createMainWindow();
	})
