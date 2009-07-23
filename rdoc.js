var TallEye = {
    homepage: "http://projects.talleye.com/ubiquity-rdoc/",
    author: { name: "Luis Cipriani", email: "lfcipriani@talleye.com"},
	contributors: ["Tino Gomes", "Jens Wille"],
    license: "MPL, GPL",
	preferences: {
		SOURCES_KEY: "extensions.ubiquity.rdoc.sources",
		DEFAULT_RDOC_KEY: "extensions.ubiquity.rdoc.default",
		PRELOADED_RDOCS: {
	        rails: "http://api.rubyonrails.org/",
	        ruby: "http://www.ruby-doc.org/core/",
			shoulda: "http://dev.thoughtbot.com/shoulda/",
	     	mocha: "http://mocha.rubyforge.org/"
	    },
		getRdocs: function() {
			if (!Application.prefs.has(this.SOURCES_KEY)) {
				Application.prefs.setValue(this.SOURCES_KEY, Utils.encodeJson(this.PRELOADED_RDOCS));
			} 
			var tempRdocs = Application.prefs.getValue(this.SOURCES_KEY, this.PRELOADED_RDOCS);
			tempRdocs = Utils.decodeJson(tempRdocs);
			var temp = {};
			for (key in tempRdocs) {
				temp[key] = { baseUrl: tempRdocs[key], isIndexed: false, searchIndex: { class: [], method: [] } }
			}
			return temp;
		},
		setDefault: function(def) {
			return Application.prefs.setValue(this.DEFAULT_RDOC_KEY, def); 
		},
		getDefault: function() {
			return Application.prefs.getValue(this.DEFAULT_RDOC_KEY, 'rails');
		},
		addRdoc: function(name, url) {
			var tempRdocs = Application.prefs.getValue(this.SOURCES_KEY, this.PRELOADED_RDOCS); 
			tempRdocs = Utils.decodeJson(tempRdocs);
			tempRdocs[name] = url;
			Application.prefs.setValue(this.SOURCES_KEY, Utils.encodeJson(tempRdocs));
			return { baseUrl: url, isIndexed: false, searchIndex: { class: [], method: [] } };
		},
		removeRdoc: function(name) {
			var tempRdocs = Application.prefs.getValue(this.SOURCES_KEY, this.PRELOADED_RDOCS); 
			tempRdocs = Utils.decodeJson(tempRdocs);
			if (delete tempRdocs[name]) {
				Application.prefs.setValue(this.SOURCES_KEY, Utils.encodeJson(tempRdocs));
				return true;
			} else {
				return false;
			}
		}
	}
};
var noun_type_rdoc = {
    _name: 'rdoc',
    _rdocs: null,
	_getRdocs: function() {
		if (!this._rdocs) {
			this._rdocs = TallEye.preferences.getRdocs();
		}
		return this._rdocs;
	},
    _getDefault: function() {
		return TallEye.preferences.getDefault();
	},
    _setDefault: function (def) {
      if (this._getRdocs()[def]) {
		TallEye.preferences.setDefault(def);
        displayMessage('OK! You can try rdoc command for '+def+' now.');
      } else {
        displayMessage('"'+def+'" doesn\'t exist in rdoc index.');
      }
    },
    _add: function(name, url) {
		this._getRdocs()[name] = TallEye.preferences.addRdoc(name, url);
        this._loadIndex(name);
    },
	_remove: function(name) {
		if (TallEye.preferences.removeRdoc(name)) {
			delete this._getRdocs()[name];
			displayMessage('The ' + name + ' rdoc is unloaded.');
		} else {
			displayMessage('There was a problem when unloading ' + name + '.');
		}
	},
    _loadIndex: function(rdoc_type, callback) {
        var indexes = ['class', 'method'];
        var thatRdocs = this._getRdocs()[rdoc_type];
        for (idx in indexes) {
          (function(idx){
            Utils.parseRemoteDocument(
                (thatRdocs.baseUrl + 'fr_'+ indexes[idx] +'_index.html'),
                null,              
                function(response) {
                   responseJSON = [];
                   jQuery("a",response).each( function(i) {
                      responseJSON.push({name: this.text, url: this.attributes[0].nodeValue});
                   });
                   thatRdocs.searchIndex[indexes[idx]] = thatRdocs.searchIndex[indexes[idx]].concat(responseJSON);
                   if (idx == 1) {
                     thatRdocs.isIndexed = true;
                     if( typeof callback == "function" ) {
                       callback();
                     }
                   }
                },
                function(){
                    displayMessage("Error when fetching rdoc index.");
                }
            );
          })(idx);
        }
    },
    suggest: function( text, html ) {
        var suggestions = [];
        for (rdoc_name in this._getRdocs()) {
            if (rdoc_name.match(text, "i")) {
                suggestions.push( CmdUtils.makeSugg(rdoc_name) );
            }
        }
        return suggestions.splice(0, 8);
    }
};
TallEye.escape = function(string) {
	tempString = "";
	escapeSet = ['\\','/','[',']','(',')','{','}','?','+','*','|','.','^','$'];
	for (i in string) {
		for (j in escapeSet) {
			if (escapeSet[j] == string[i]) {
				tempString = tempString + '\\';
			} 
		}
		tempString = tempString + string[i];
	}
	return tempString;
};
TallEye.availableRdocs = function() {
	result = '<p>Available RDocs:</p><ul>';
	for (key in noun_type_rdoc._getRdocs()) {
		result += '<li>' + key + '</li>';
	}
	result += '</ul>';
	return result;
};
TallEye.searchOnRdoc = function(searchTerm, rdoc_type, previewBlock) {
    var suggestions = [];
	var searchTerm_original = searchTerm;
	searchTerm = TallEye.escape(searchTerm);
	if (searchTerm.indexOf("#") == -1) { // when searching for Class_or_method
	    var fullIndex = noun_type_rdoc._getRdocs()[rdoc_type].searchIndex['class'].concat( noun_type_rdoc._getRdocs()[rdoc_type].searchIndex['method'] );

	    for ( var term in fullIndex ) {
	      if (fullIndex[term].name.match(searchTerm, "i")) {
	         suggestions.push({name: fullIndex[term].name, url: noun_type_rdoc._getRdocs()[rdoc_type].baseUrl + fullIndex[term].url});
	      }
	    }
	} else { // when searching for Class#method
		var terms = searchTerm.split("#");
		var methodIndex = noun_type_rdoc._getRdocs()[rdoc_type].searchIndex['method'];
		var regexpr = /^(.+)\s\((.+)\)$/i;
		
		for ( var term in methodIndex ) {
		  	var indexTerms = regexpr.exec(methodIndex[term].name);
			// Class
	    	if (indexTerms[2].match(terms[0], "i")) {
		 		// Class#method
				if (indexTerms[1].match(terms[1], "i")) {
	    			suggestions.push({name: methodIndex[term].name, url: noun_type_rdoc._getRdocs()[rdoc_type].baseUrl + methodIndex[term].url});
				}
	    	}
	    }
	}
    previewBlock.innerHTML = CmdUtils.renderTemplate( jQuery("#rdoc-search", feed.dom).html(),
          { suggestions:suggestions,
			suggestionCount: suggestions.length,
            searchTerm:searchTerm_original,
            rdoc: rdoc_type, 
			indexReady: noun_type_rdoc._getRdocs()[rdoc_type].isIndexed
          }
    );
};
// translates Parser 2 commands to Parser 1; applies some defaults for all commands
TallEye.createCommand = function(cmd) {
  // default settings
  if (!cmd.icon) {
    cmd.icon         = "http://projects.talleye.com/ubiquity-rdoc/images/ruby.png";
  }
  if (!cmd.homepage) {
    cmd.homepage     = TallEye.homepage;
  }
  if (!cmd.author) {
    cmd.author       = TallEye.author;
  }
  if (!cmd.license) {
    cmd.license      = TallEye.license;
  }
  if (!cmd.contributors) {
    cmd.contributors = TallEye.contributors;
  }

  if (CmdUtils.parserVersion == 2) {
    // should be fine...
  }
  else {
    // names -> name + synonyms
    var names = cmd.names;
    cmd.name = names.shift();

    if (names.length > 0) {
      cmd.synonyms = names;
    }

    cmd.names = null;

    // map modifier's label to its role for preview + execute
    var modifier_map = {};

    // arguments -> takes + modifiers
    for (var i = 0; i < cmd.arguments.length; i++) {
      var arg = cmd.arguments[i];
      var attr = "takes";

      if (arg.role != "object") {
        attr = "modifiers";
        modifier_map[arg.label] = arg.role;
      }

      if (!cmd[attr]) {
        cmd[attr] = {};
      }

      cmd[attr][arg.label] = arg.nountype;
    }

    cmd.arguments = null;

    // preview + execute argument handling
    var pre = cmd.preview;
    if (pre) {
      cmd.preview = function(pblock, object, modifiers) {
        var args = { object: object };

        for (attr in modifiers) {
          args[modifier_map[attr]] = modifiers[attr];
        }

        pre(pblock, args);
      };
    }

    var exe = cmd.execute;
    if (exe) {
      cmd.execute = function(object, modifiers) {
        var args = { object: object };

        for (attr in modifiers) {
          args[modifier_map[attr]] = modifiers[attr];
        }

        exe(args);
      };
    }
  }

  CmdUtils.CreateCommand(cmd);
};
TallEye.createCommand({
    names: ["rdoc"],
    description: "Searches for classes or methods in a RDoc for your words.",
    help: "Enter 'rdoc' + any class or method name + if you want to search on a specific rdoc, 'in' + name of available rdoc. The default rdoc is rails.",
    arguments: [{ role: "object", nountype: noun_arb_text, label: "class or method" },
                { role: "location", nountype: noun_type_rdoc, label: "in" }],
	previewDelay: 1000,
    preview: function(pblock, args) {
        var searchTerm = args.object.text;
        var rdoc_type = args.location.text || noun_type_rdoc._getDefault();
        if(searchTerm.length < 1) {
          pblock.innerHTML = "Searches for classes or methods in a RDoc for your words.";
          return;
        }
        if (!noun_type_rdoc._getRdocs()[rdoc_type].isIndexed) {
            noun_type_rdoc._loadIndex(rdoc_type, function() {
                TallEye.searchOnRdoc(searchTerm, rdoc_type, pblock);
            });
        }
        TallEye.searchOnRdoc(searchTerm, rdoc_type, pblock);
    },
    execute: function(args) {
		var rdoc_type = args.location.text || noun_type_rdoc._getDefault();
        if(args.object.text.length < 1) {
			Utils.openUrlInBrowser( noun_type_rdoc._getRdocs()[rdoc_type].baseUrl );
        } else {
			args.object.text = TallEye.escape(args.object.text);
			if (args.object.text.indexOf("#") == -1) { // when searching for Class_or_method
				var fullIndex = noun_type_rdoc._getRdocs()[rdoc_type].searchIndex['class'].concat( noun_type_rdoc._getRdocs()[rdoc_type].searchIndex['method'] );
			    for ( var term in fullIndex ) {
			      if (fullIndex[term].name.match(args.object.text, "i")) {
					 Utils.openUrlInBrowser( noun_type_rdoc._getRdocs()[rdoc_type].baseUrl + fullIndex[term].url );
			         break;
			      }
			    }
			} else { // when searching for Class#method
				var terms = args.object.text.split("#");
				var methodIndex = noun_type_rdoc._getRdocs()[rdoc_type].searchIndex['method'];
				var regexpr = /^(.+)\s\((.+)\)$/i;

				for ( var term in methodIndex ) {
				  	var indexTerms = regexpr.exec(methodIndex[term].name);
					// Class
			    	if (indexTerms[2].match(terms[0], "i")) {
				 		// Class#method
						if (indexTerms[1].match(terms[1], "i")) {
							Utils.openUrlInBrowser( noun_type_rdoc._getRdocs()[rdoc_type].baseUrl + methodIndex[term].url );
			    			break;
						}
			    	}
			    }
			}
		}
    }
});
TallEye.createCommand({
    names: ["rdoc-load"],
    description: "Command for loading rdocs to rdoc command.",
    help: "If your favorite rdoc is not available, don't worry, just use 'rdoc-load' + base url + 'as' + name of your favorite rdoc. Example: rdoc-load http://api.rubyonrails.org/ as rails",
    arguments: [{ role: "object", nountype: noun_type_url, label: "rdoc base URL" },
                { role: "alias", nountype: noun_arb_text, label: "as" }],
    _validate: function (url, rdoc_name) {
        var result = [false,false];
        var indexes = ['class', 'method'];
        var template = ['Classes', 'Methods']
        if (url[url.length-1] != '/') url += '/';
        for (idx in indexes) {
          (function(idx){
            Utils.parseRemoteDocument(
                (url + 'fr_'+ indexes[idx] +'_index.html'),
                null,              
                function(response) {
                   var page_header = jQuery("h1",response);
                   var page_index = jQuery("#index-entries",response);
                   result[idx] = (page_header.text() == template[idx] && page_index.length == 1);
                   if (idx == 1) {
                      if (result[0] && result[1]) {
                        noun_type_rdoc._add(rdoc_name, url);
                        displayMessage("Rdoc added successfully!\n\nTry: rdoc [term] in "+rdoc_name);
                      } else {
                        displayMessage("Rdoc url not valid!\n\nExample: rdoc-load http://api.rubyonrails.org/ as rails");
                      }
                   }
                },
                function(){
                    displayMessage("Rdoc url not valid!\n\nExample: rdoc-load http://api.rubyonrails.org/ as rails");
                }
            );
          })(idx);
        }
    },
    preview: function(pblock, args) {
        var searchTerm = args.object.text;
        var rdoc_suggested_name = args.alias.text || "rdoc-name";
        if(searchTerm.length < 1) {
          pblock.innerHTML = "Adds a Rdoc to rdoc command";
          return;
        }
        pblock.innerHTML = "Adds Rdoc hosted at <b style=\"color:yellow\">"+ searchTerm +"</b> as <b style=\"color:yellow\">"+ rdoc_suggested_name +"</b> to rdoc command.<br /><small>obs.: You can also overwrite an existent rdoc index by just typing the same name used by rdoc command.</small>";
    },
    execute: function(args) {
        this._validate(args.object.text, args.alias.text);
    }
});
TallEye.createCommand({
    names: ["rdoc-unload"],
    description: "Command for loading rdocs to rdoc command.",
    help: "If you want to unload any rdoc, type 'rdoc-unload' + loaded rdoc name",
    arguments: [{ role: "object", nountype: noun_type_rdoc, label: "rdoc" }],
    preview: function(pblock, args) {
        var searchTerm = args.object.text;
        if(searchTerm.length < 1) {
          pblock.innerHTML = "Unload a rdoc." + TallEye.availableRdocs();
          return;
        } 
        pblock.innerHTML = "Unload <b style=\"color:yellow\">"+ searchTerm +"</b> rdoc. You won't be able to search on this rdoc anymore." + TallEye.availableRdocs();
    }, 
    execute: function(args) {
        noun_type_rdoc._remove(args.object.text);
    } 
});
TallEye.createCommand({
    names: ["rdoc-default"],
    description: "Command for change the default rdoc when searching with rdoc command.",
    help: "If you tired to put 'in [your favorite rdoc]' on each rdoc search command, use this command to change the default rdoc when searching.",
    arguments: [{ role: "object", nountype: noun_type_rdoc, label: "rdoc" }],
    preview: function(pblock, args) {
        var searchTerm = args.object.text;
        if(searchTerm.length < 1) {
          pblock.innerHTML = "Change the default rdoc search (current: <b style=\"color:yellow\">"+ noun_type_rdoc._getDefault() +"</b>)" + TallEye.availableRdocs();
          return;
        } 
        pblock.innerHTML = "Change the default rdoc search from <b style=\"color:yellow\">"+ noun_type_rdoc._getDefault() +"</b> to <b style=\"color:yellow\">"+ searchTerm +"</b> on rdoc command." + TallEye.availableRdocs();
    }, 
    execute: function(args) {
        noun_type_rdoc._setDefault(args.object.text);
    } 
});
