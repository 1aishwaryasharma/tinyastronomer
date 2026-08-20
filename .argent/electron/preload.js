'use strict';

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('taQa', true);
