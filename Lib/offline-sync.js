/*!
 * Offline Class
 * @author Anakeen
 * @license http://www.fsf.org/licensing/licenses/agpl-3.0.html GNU Affero General Public License
 */

/**
 * @class Fdl.OfflineSync
 * @param {Object}
 *            config
 * @cfg {Fdl.context} context the current context connection
 * @cfg {String} name the application name
 * @constructor
 */

/**
 * @param {Object}
 *            config
 *            <ul>
 *            <li><b>context : </b>{Fdl.Context} the current context</li>
 *            <li><b>domain : </b>{Fdl.OfflineDomain} the current domain</li>
 *            </ul>
 * @return {Fdl.Document} reverted document
 */
Fdl.OfflineSync = function(config) {
	if (config && config.context) {
		this.context = config.context;
		this.domain = config.domain;

	}
};

Fdl.OfflineSync.prototype = {
	/**
	 * context
	 * 
	 * @private
	 * @type {Fdl.Context}
	 */
	context : null,
	/**
	 * context
	 * 
	 * @private
	 * @type {Fdl.OfflineDomain}
	 */
	domain : null,
	/**
	 * indicate transaction as began
	 * 
	 * @private
	 * @type {Numeric}
	 */
	transactionId : null,
	/**
	 * is set after endTransaction
	 * indique detail about transaction
	 * 
	 * @type {Object}
	 */
	transactionStatus : null,




	/**
	 * begin transaction
	 * 
	 * @param {Object}
	 *            config
	 *            <ul>
	 * 
	 * </ul>
	 * @return {Numeric} transactionId if ok, false if a transaction is already
	 *         in progress
	 */
	beginTransaction : function(config) {
		var data = this.callSyncMethod({
			method : 'beginTransaction'
		});
		if (data) {
			if (data.error) {
				this.transactionId = null;
				this.context.setErrorMessage(data.error);
			} else {
				this.transactionId = data.transactionId;
			}
			return this.transactionId;
		}
		return null;
	},

	/**
	 * return last transaction status
	 */
	getTransactionStatus : function () {
		return this.transactionStatus;
	},
	/**
	 * end transaction
	 * 
	 * @param {Object}
	 *            config
	 *            <ul>
	 * 
	 * </ul>
	 * @return {Boolean} true if ok, false if a transaction is not began
	 */
	endTransaction : function(config) {
		var data = this.callSyncMethod({
			method : 'endTransaction',
			transaction : this.transactionId
		});

		if (data) {
			this.transactionStatus=data;
			if (data.error) {
				this.context.setErrorMessage(data.error);
				return false;
			} else {
				this.transactionId = null;
				return true;
			}

		}
		return null;
	},
	

	/**
	 * save document to the server
	 * 
	 * @param {Object}
	 *            config
	 *            <ul>
	 *            <li><b>document : </b>{Fdl.Document} the document to save</li>
	 *            <li><b>bodyElement : </b>{htmlElement} an object where attach
	 *            temporary form</li>
	 *            </ul>
	 * @return {Fdl.Document} pushed document (null if error)
	 */
	pushDocument : function(config) {
		if (config && config.document) {
			config.method = 'pushDocument';
			config.transaction=this.transactionId;
			var data = this.callSyncMethod(config);
			
			if (data) {
				if (!data.error) {
					return this.context.getDocument({
						data : data
					});
				}
			}
		}
		return null;
	},
	/**
	 * save file into document to the server
	 * 
	 * @param {Object}
	 *            config
	 *            <ul>
	 *            <li><b>path : </b>{String} local path</li>
	 *            <li><b>documentId : </b>{Numeric} document identificator</li>
	 *            <li><b>attributeId : </b>{String} attribute identificator use bracket to specify index : my_attr[2] indicate third file of a multiple value</li>
	 *            </ul>
	 * @return {Fdl.Document} pushed document (null if error)
	 */
	pushFile : function(config) {
		// Make a stream from a file.
		if (config && config.path && config.documentId && config.attributeId) {

			var path = config.path;
			var file = Components.classes["@mozilla.org/file/local;1"]
					.createInstance(Components.interfaces.nsILocalFile);
			file.initWithPath(path);

			if (file.exists() == false) {
				throw new Error('file ' + path + ' not exists');
			}
			var url = this.context.url
					+ '?app=OFFLINE&action=OFF_DOMAINAPI&use=sync&method=pushFile&id='
					+ this.domain.id + '&docid=' + config.documentId + '&aid='
					+ config.attributeId + '&filename=' + file.leafName + '&transaction='+this.transactionId;
			var stream = Components.classes["@mozilla.org/network/file-input-stream;1"]
					.createInstance(Components.interfaces.nsIFileInputStream);
			stream.init(file, 0x01 | 0x08, 0644, 0x04); // file is an nsIFile
			// instance

			// Try to determine the MIME type of the file
			var mimeType = "text/plain";
			try {
				var mimeService = Components.classes["@mozilla.org/mime;1"]
						.getService(Components.interfaces.nsIMIMEService);
				mimeType = mimeService.getTypeFromFile(file); // file is an
				// nsIFile instance
			} catch (e) { /* eat it; just use text/plain */
			}

			// Send
			var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance(Components.interfaces.nsIXMLHttpRequest);
			req.open('PUT', url, false); /* synchronous! */
			req.setRequestHeader('Content-Type', mimeType);
			req.send(stream);
		}
		return null;
	},

	/**
	 * save or update document to/ from the server if document is reserved =>
	 * save else update
	 * 
	 * @param {Object}
	 *            config
	 *            <ul>
	 *            <li><b>document : </b>{Fdl.Document} the document to
	 *            synchronise</li>
	 *            </ul>
	 * @return {Fdl.Document} reverted document (null if error)
	 */
	synchronizeDocument : function(config) {
		return null; //TODO
	},

	/**
	 * retrieve server document and replace local document
	 * 
	 * @param {Object}
	 *            config
	 *            <ul>
	 *            <li><b>document : </b>{Fdl.Document} the document to revert</li>
	 *            </ul>
	 * @return {Fdl.Document} reverted document (null if error)
	 */
	revertDocument : function(config) {
		if (config && config.document) {
			config.method = 'revertDocument';
			config.docid = document.id;
			var data = this.callSyncMethod(config); 

			if (data) {
				if (!data.error) {
					return this.context.getDocument({
						data : data
					});
				}
			}
		}
		return null;
	},

	toString : function() {
		return 'Fdl.OfflineSync';
	}
};


/**
 * retrieve content (recursive) of shared folder
 * 
 * @param object config
 *            <ul>
 *            <li><b>until : </b>{String} date since documents has been
 *            modified</li>
 *            </ul>
 * @return {Fdl.DocumentList} list of document of user's domain
 */
Fdl.OfflineSync.prototype.getSharedDocuments = function(config) {
	var until = null;
	if (config && config.until) {
		until = config.until;
	}
	var data = this.callSyncMethod({
		method : 'getSharedDocuments',
		until : until
	});
	if (data) {
		data.acknowledgement=this.callSyncMethod({
			method : 'getSharedDocumentsAcknowledgement'
		});
		data.context = this.context;
		return new Fdl.DocumentList(data);

	} else {
		return null;
	}
};

/**
 * retrieve content (recursive) of user folder
 * @param object config
 *            <ul>
 *            <li><b>until : </b>{String} date since documents has been
 *            modified</li>
 *            </ul>
 * @return {Fdl.DocumentList} list of document of user's domain
 */
Fdl.OfflineSync.prototype.getUserDocuments = function(config) {
	var until = null;
	if (config && config.until) {
		until = config.until;
	}
	var data = this.callSyncMethod({
		method : 'getUserDocuments',until:until
	});
	if (data) {
		data.acknowledgement=this.callSyncMethod({
			method : 'getUserDocumentsAcknowledgement'
		});
		data.context = this.context;
		return new Fdl.DocumentList(data);

	} else {
		return null;
	}

};

/**
 * Call a method for domain api
 * 
 * @param object
 *            config include method attribute and specific parameters
 * @private
 * @return {Object}
 */
Fdl.OfflineSync.prototype.callSyncMethod = function(config) {
	if (config && config.method) {
		var data = this.context.retrieveData({
			app : 'OFFLINE',
			action : 'OFF_DOMAINAPI',
			method : config.method,
			use : 'sync',
			id : this.domain.id
		}, config);

		if (data) {
			if (!data.error) {
				return data;
			} else {
				this.context.setErrorMessage(data.error);
			}
		} else {
			this.context.setErrorMessage(config.method + ' : no data');
		}
	}
	return null;
};