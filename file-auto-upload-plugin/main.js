'use strict';

var obsidian = require('obsidian');
var require$$0 = require('fs');
var process$2 = require('node:process');
var require$$0$1 = require('path');
var require$$0$2 = require('child_process');
var require$$0$3 = require('os');
var require$$0$4 = require('assert');
var require$$2 = require('events');
var require$$0$6 = require('buffer');
var require$$0$5 = require('stream');
var require$$2$1 = require('util');
var node_os = require('node:os');
require('electron');
var view = require('@codemirror/view');
var state = require('@codemirror/state');
var language = require('@codemirror/language');
var node_buffer = require('node:buffer');

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function assertPath(path) {
  if (typeof path !== 'string') {
    throw new TypeError('Path must be a string. Received ' + JSON.stringify(path));
  }
}

// Resolves . and .. elements in a path with directory names
function normalizeStringPosix(path, allowAboveRoot) {
  var res = '';
  var lastSegmentLength = 0;
  var lastSlash = -1;
  var dots = 0;
  var code;
  for (var i = 0; i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (code === 47 /*/*/)
      break;
    else
      code = 47 /*/*/;
    if (code === 47 /*/*/) {
      if (lastSlash === i - 1 || dots === 1) ; else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 /*.*/ || res.charCodeAt(res.length - 2) !== 46 /*.*/) {
          if (res.length > 2) {
            var lastSlashIndex = res.lastIndexOf('/');
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1) {
                res = '';
                lastSegmentLength = 0;
              } else {
                res = res.slice(0, lastSlashIndex);
                lastSegmentLength = res.length - 1 - res.lastIndexOf('/');
              }
              lastSlash = i;
              dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = '';
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0)
            res += '/..';
          else
            res = '..';
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0)
          res += '/' + path.slice(lastSlash + 1, i);
        else
          res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === 46 /*.*/ && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}

function _format(sep, pathObject) {
  var dir = pathObject.dir || pathObject.root;
  var base = pathObject.base || (pathObject.name || '') + (pathObject.ext || '');
  if (!dir) {
    return base;
  }
  if (dir === pathObject.root) {
    return dir + base;
  }
  return dir + sep + base;
}

var posix = {
  // path.resolve([from ...], to)
  resolve: function resolve() {
    var resolvedPath = '';
    var resolvedAbsolute = false;
    var cwd;

    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path;
      if (i >= 0)
        path = arguments[i];
      else {
        if (cwd === undefined)
          cwd = process.cwd();
        path = cwd;
      }

      assertPath(path);

      // Skip empty entries
      if (path.length === 0) {
        continue;
      }

      resolvedPath = path + '/' + resolvedPath;
      resolvedAbsolute = path.charCodeAt(0) === 47 /*/*/;
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute);

    if (resolvedAbsolute) {
      if (resolvedPath.length > 0)
        return '/' + resolvedPath;
      else
        return '/';
    } else if (resolvedPath.length > 0) {
      return resolvedPath;
    } else {
      return '.';
    }
  },

  normalize: function normalize(path) {
    assertPath(path);

    if (path.length === 0) return '.';

    var isAbsolute = path.charCodeAt(0) === 47 /*/*/;
    var trailingSeparator = path.charCodeAt(path.length - 1) === 47 /*/*/;

    // Normalize the path
    path = normalizeStringPosix(path, !isAbsolute);

    if (path.length === 0 && !isAbsolute) path = '.';
    if (path.length > 0 && trailingSeparator) path += '/';

    if (isAbsolute) return '/' + path;
    return path;
  },

  isAbsolute: function isAbsolute(path) {
    assertPath(path);
    return path.length > 0 && path.charCodeAt(0) === 47 /*/*/;
  },

  join: function join() {
    if (arguments.length === 0)
      return '.';
    var joined;
    for (var i = 0; i < arguments.length; ++i) {
      var arg = arguments[i];
      assertPath(arg);
      if (arg.length > 0) {
        if (joined === undefined)
          joined = arg;
        else
          joined += '/' + arg;
      }
    }
    if (joined === undefined)
      return '.';
    return posix.normalize(joined);
  },

  relative: function relative(from, to) {
    assertPath(from);
    assertPath(to);

    if (from === to) return '';

    from = posix.resolve(from);
    to = posix.resolve(to);

    if (from === to) return '';

    // Trim any leading backslashes
    var fromStart = 1;
    for (; fromStart < from.length; ++fromStart) {
      if (from.charCodeAt(fromStart) !== 47 /*/*/)
        break;
    }
    var fromEnd = from.length;
    var fromLen = fromEnd - fromStart;

    // Trim any leading backslashes
    var toStart = 1;
    for (; toStart < to.length; ++toStart) {
      if (to.charCodeAt(toStart) !== 47 /*/*/)
        break;
    }
    var toEnd = to.length;
    var toLen = toEnd - toStart;

    // Compare paths to find the longest common path from root
    var length = fromLen < toLen ? fromLen : toLen;
    var lastCommonSep = -1;
    var i = 0;
    for (; i <= length; ++i) {
      if (i === length) {
        if (toLen > length) {
          if (to.charCodeAt(toStart + i) === 47 /*/*/) {
            // We get here if `from` is the exact base path for `to`.
            // For example: from='/foo/bar'; to='/foo/bar/baz'
            return to.slice(toStart + i + 1);
          } else if (i === 0) {
            // We get here if `from` is the root
            // For example: from='/'; to='/foo'
            return to.slice(toStart + i);
          }
        } else if (fromLen > length) {
          if (from.charCodeAt(fromStart + i) === 47 /*/*/) {
            // We get here if `to` is the exact base path for `from`.
            // For example: from='/foo/bar/baz'; to='/foo/bar'
            lastCommonSep = i;
          } else if (i === 0) {
            // We get here if `to` is the root.
            // For example: from='/foo'; to='/'
            lastCommonSep = 0;
          }
        }
        break;
      }
      var fromCode = from.charCodeAt(fromStart + i);
      var toCode = to.charCodeAt(toStart + i);
      if (fromCode !== toCode)
        break;
      else if (fromCode === 47 /*/*/)
        lastCommonSep = i;
    }

    var out = '';
    // Generate the relative path based on the path difference between `to`
    // and `from`
    for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
      if (i === fromEnd || from.charCodeAt(i) === 47 /*/*/) {
        if (out.length === 0)
          out += '..';
        else
          out += '/..';
      }
    }

    // Lastly, append the rest of the destination (`to`) path that comes after
    // the common path parts
    if (out.length > 0)
      return out + to.slice(toStart + lastCommonSep);
    else {
      toStart += lastCommonSep;
      if (to.charCodeAt(toStart) === 47 /*/*/)
        ++toStart;
      return to.slice(toStart);
    }
  },

  _makeLong: function _makeLong(path) {
    return path;
  },

  dirname: function dirname(path) {
    assertPath(path);
    if (path.length === 0) return '.';
    var code = path.charCodeAt(0);
    var hasRoot = code === 47 /*/*/;
    var end = -1;
    var matchedSlash = true;
    for (var i = path.length - 1; i >= 1; --i) {
      code = path.charCodeAt(i);
      if (code === 47 /*/*/) {
          if (!matchedSlash) {
            end = i;
            break;
          }
        } else {
        // We saw the first non-path separator
        matchedSlash = false;
      }
    }

    if (end === -1) return hasRoot ? '/' : '.';
    if (hasRoot && end === 1) return '//';
    return path.slice(0, end);
  },

  basename: function basename(path, ext) {
    if (ext !== undefined && typeof ext !== 'string') throw new TypeError('"ext" argument must be a string');
    assertPath(path);

    var start = 0;
    var end = -1;
    var matchedSlash = true;
    var i;

    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
      if (ext.length === path.length && ext === path) return '';
      var extIdx = ext.length - 1;
      var firstNonSlashEnd = -1;
      for (i = path.length - 1; i >= 0; --i) {
        var code = path.charCodeAt(i);
        if (code === 47 /*/*/) {
            // If we reached a path separator that was not part of a set of path
            // separators at the end of the string, stop now
            if (!matchedSlash) {
              start = i + 1;
              break;
            }
          } else {
          if (firstNonSlashEnd === -1) {
            // We saw the first non-path separator, remember this index in case
            // we need it if the extension ends up not matching
            matchedSlash = false;
            firstNonSlashEnd = i + 1;
          }
          if (extIdx >= 0) {
            // Try to match the explicit extension
            if (code === ext.charCodeAt(extIdx)) {
              if (--extIdx === -1) {
                // We matched the extension, so mark this as the end of our path
                // component
                end = i;
              }
            } else {
              // Extension does not match, so our result is the entire path
              // component
              extIdx = -1;
              end = firstNonSlashEnd;
            }
          }
        }
      }

      if (start === end) end = firstNonSlashEnd;else if (end === -1) end = path.length;
      return path.slice(start, end);
    } else {
      for (i = path.length - 1; i >= 0; --i) {
        if (path.charCodeAt(i) === 47 /*/*/) {
            // If we reached a path separator that was not part of a set of path
            // separators at the end of the string, stop now
            if (!matchedSlash) {
              start = i + 1;
              break;
            }
          } else if (end === -1) {
          // We saw the first non-path separator, mark this as the end of our
          // path component
          matchedSlash = false;
          end = i + 1;
        }
      }

      if (end === -1) return '';
      return path.slice(start, end);
    }
  },

  extname: function extname(path) {
    assertPath(path);
    var startDot = -1;
    var startPart = 0;
    var end = -1;
    var matchedSlash = true;
    // Track the state of characters (if any) we see before our first dot and
    // after any path separator we find
    var preDotState = 0;
    for (var i = path.length - 1; i >= 0; --i) {
      var code = path.charCodeAt(i);
      if (code === 47 /*/*/) {
          // If we reached a path separator that was not part of a set of path
          // separators at the end of the string, stop now
          if (!matchedSlash) {
            startPart = i + 1;
            break;
          }
          continue;
        }
      if (end === -1) {
        // We saw the first non-path separator, mark this as the end of our
        // extension
        matchedSlash = false;
        end = i + 1;
      }
      if (code === 46 /*.*/) {
          // If this is our first dot, mark it as the start of our extension
          if (startDot === -1)
            startDot = i;
          else if (preDotState !== 1)
            preDotState = 1;
      } else if (startDot !== -1) {
        // We saw a non-dot and non-path separator before our dot, so we should
        // have a good chance at having a non-empty extension
        preDotState = -1;
      }
    }

    if (startDot === -1 || end === -1 ||
        // We saw a non-dot character immediately before the dot
        preDotState === 0 ||
        // The (right-most) trimmed path component is exactly '..'
        preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
      return '';
    }
    return path.slice(startDot, end);
  },

  format: function format(pathObject) {
    if (pathObject === null || typeof pathObject !== 'object') {
      throw new TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof pathObject);
    }
    return _format('/', pathObject);
  },

  parse: function parse(path) {
    assertPath(path);

    var ret = { root: '', dir: '', base: '', ext: '', name: '' };
    if (path.length === 0) return ret;
    var code = path.charCodeAt(0);
    var isAbsolute = code === 47 /*/*/;
    var start;
    if (isAbsolute) {
      ret.root = '/';
      start = 1;
    } else {
      start = 0;
    }
    var startDot = -1;
    var startPart = 0;
    var end = -1;
    var matchedSlash = true;
    var i = path.length - 1;

    // Track the state of characters (if any) we see before our first dot and
    // after any path separator we find
    var preDotState = 0;

    // Get non-dir info
    for (; i >= start; --i) {
      code = path.charCodeAt(i);
      if (code === 47 /*/*/) {
          // If we reached a path separator that was not part of a set of path
          // separators at the end of the string, stop now
          if (!matchedSlash) {
            startPart = i + 1;
            break;
          }
          continue;
        }
      if (end === -1) {
        // We saw the first non-path separator, mark this as the end of our
        // extension
        matchedSlash = false;
        end = i + 1;
      }
      if (code === 46 /*.*/) {
          // If this is our first dot, mark it as the start of our extension
          if (startDot === -1) startDot = i;else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
        // We saw a non-dot and non-path separator before our dot, so we should
        // have a good chance at having a non-empty extension
        preDotState = -1;
      }
    }

    if (startDot === -1 || end === -1 ||
    // We saw a non-dot character immediately before the dot
    preDotState === 0 ||
    // The (right-most) trimmed path component is exactly '..'
    preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
      if (end !== -1) {
        if (startPart === 0 && isAbsolute) ret.base = ret.name = path.slice(1, end);else ret.base = ret.name = path.slice(startPart, end);
      }
    } else {
      if (startPart === 0 && isAbsolute) {
        ret.name = path.slice(1, startDot);
        ret.base = path.slice(1, end);
      } else {
        ret.name = path.slice(startPart, startDot);
        ret.base = path.slice(startPart, end);
      }
      ret.ext = path.slice(startDot, end);
    }

    if (startPart > 0) ret.dir = path.slice(0, startPart - 1);else if (isAbsolute) ret.dir = '/';

    return ret;
  },

  sep: '/',
  delimiter: ':',
  win32: null,
  posix: null
};

posix.posix = posix;

var pathBrowserify = posix;

var execa$2 = {exports: {}};

var crossSpawn$1 = {exports: {}};

var windows;
var hasRequiredWindows;

function requireWindows () {
	if (hasRequiredWindows) return windows;
	hasRequiredWindows = 1;
	windows = isexe;
	isexe.sync = sync;

	var fs = require$$0;

	function checkPathExt (path, options) {
	  var pathext = options.pathExt !== undefined ?
	    options.pathExt : process.env.PATHEXT;

	  if (!pathext) {
	    return true
	  }

	  pathext = pathext.split(';');
	  if (pathext.indexOf('') !== -1) {
	    return true
	  }
	  for (var i = 0; i < pathext.length; i++) {
	    var p = pathext[i].toLowerCase();
	    if (p && path.substr(-p.length).toLowerCase() === p) {
	      return true
	    }
	  }
	  return false
	}

	function checkStat (stat, path, options) {
	  if (!stat.isSymbolicLink() && !stat.isFile()) {
	    return false
	  }
	  return checkPathExt(path, options)
	}

	function isexe (path, options, cb) {
	  fs.stat(path, function (er, stat) {
	    cb(er, er ? false : checkStat(stat, path, options));
	  });
	}

	function sync (path, options) {
	  return checkStat(fs.statSync(path), path, options)
	}
	return windows;
}

var mode;
var hasRequiredMode;

function requireMode () {
	if (hasRequiredMode) return mode;
	hasRequiredMode = 1;
	mode = isexe;
	isexe.sync = sync;

	var fs = require$$0;

	function isexe (path, options, cb) {
	  fs.stat(path, function (er, stat) {
	    cb(er, er ? false : checkStat(stat, options));
	  });
	}

	function sync (path, options) {
	  return checkStat(fs.statSync(path), options)
	}

	function checkStat (stat, options) {
	  return stat.isFile() && checkMode(stat, options)
	}

	function checkMode (stat, options) {
	  var mod = stat.mode;
	  var uid = stat.uid;
	  var gid = stat.gid;

	  var myUid = options.uid !== undefined ?
	    options.uid : process.getuid && process.getuid();
	  var myGid = options.gid !== undefined ?
	    options.gid : process.getgid && process.getgid();

	  var u = parseInt('100', 8);
	  var g = parseInt('010', 8);
	  var o = parseInt('001', 8);
	  var ug = u | g;

	  var ret = (mod & o) ||
	    (mod & g) && gid === myGid ||
	    (mod & u) && uid === myUid ||
	    (mod & ug) && myUid === 0;

	  return ret
	}
	return mode;
}

var core$1;
if (process.platform === 'win32' || commonjsGlobal.TESTING_WINDOWS) {
  core$1 = requireWindows();
} else {
  core$1 = requireMode();
}

var isexe_1 = isexe$1;
isexe$1.sync = sync;

function isexe$1 (path, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }

  if (!cb) {
    if (typeof Promise !== 'function') {
      throw new TypeError('callback not provided')
    }

    return new Promise(function (resolve, reject) {
      isexe$1(path, options || {}, function (er, is) {
        if (er) {
          reject(er);
        } else {
          resolve(is);
        }
      });
    })
  }

  core$1(path, options || {}, function (er, is) {
    // ignore EACCES because that just means we aren't allowed to run it
    if (er) {
      if (er.code === 'EACCES' || options && options.ignoreErrors) {
        er = null;
        is = false;
      }
    }
    cb(er, is);
  });
}

function sync (path, options) {
  // my kingdom for a filtered catch
  try {
    return core$1.sync(path, options || {})
  } catch (er) {
    if (options && options.ignoreErrors || er.code === 'EACCES') {
      return false
    } else {
      throw er
    }
  }
}

const isWindows = process.platform === 'win32' ||
    process.env.OSTYPE === 'cygwin' ||
    process.env.OSTYPE === 'msys';

const path$3 = require$$0$1;
const COLON = isWindows ? ';' : ':';
const isexe = isexe_1;

const getNotFoundError = (cmd) =>
  Object.assign(new Error(`not found: ${cmd}`), { code: 'ENOENT' });

const getPathInfo = (cmd, opt) => {
  const colon = opt.colon || COLON;

  // If it has a slash, then we don't bother searching the pathenv.
  // just check the file itself, and that's it.
  const pathEnv = cmd.match(/\//) || isWindows && cmd.match(/\\/) ? ['']
    : (
      [
        // windows always checks the cwd first
        ...(isWindows ? [process.cwd()] : []),
        ...(opt.path || process.env.PATH ||
          /* istanbul ignore next: very unusual */ '').split(colon),
      ]
    );
  const pathExtExe = isWindows
    ? opt.pathExt || process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM'
    : '';
  const pathExt = isWindows ? pathExtExe.split(colon) : [''];

  if (isWindows) {
    if (cmd.indexOf('.') !== -1 && pathExt[0] !== '')
      pathExt.unshift('');
  }

  return {
    pathEnv,
    pathExt,
    pathExtExe,
  }
};

const which$1 = (cmd, opt, cb) => {
  if (typeof opt === 'function') {
    cb = opt;
    opt = {};
  }
  if (!opt)
    opt = {};

  const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
  const found = [];

  const step = i => new Promise((resolve, reject) => {
    if (i === pathEnv.length)
      return opt.all && found.length ? resolve(found)
        : reject(getNotFoundError(cmd))

    const ppRaw = pathEnv[i];
    const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;

    const pCmd = path$3.join(pathPart, cmd);
    const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd
      : pCmd;

    resolve(subStep(p, i, 0));
  });

  const subStep = (p, i, ii) => new Promise((resolve, reject) => {
    if (ii === pathExt.length)
      return resolve(step(i + 1))
    const ext = pathExt[ii];
    isexe(p + ext, { pathExt: pathExtExe }, (er, is) => {
      if (!er && is) {
        if (opt.all)
          found.push(p + ext);
        else
          return resolve(p + ext)
      }
      return resolve(subStep(p, i, ii + 1))
    });
  });

  return cb ? step(0).then(res => cb(null, res), cb) : step(0)
};

const whichSync = (cmd, opt) => {
  opt = opt || {};

  const { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt);
  const found = [];

  for (let i = 0; i < pathEnv.length; i ++) {
    const ppRaw = pathEnv[i];
    const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw;

    const pCmd = path$3.join(pathPart, cmd);
    const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd
      : pCmd;

    for (let j = 0; j < pathExt.length; j ++) {
      const cur = p + pathExt[j];
      try {
        const is = isexe.sync(cur, { pathExt: pathExtExe });
        if (is) {
          if (opt.all)
            found.push(cur);
          else
            return cur
        }
      } catch (ex) {}
    }
  }

  if (opt.all && found.length)
    return found

  if (opt.nothrow)
    return null

  throw getNotFoundError(cmd)
};

var which_1 = which$1;
which$1.sync = whichSync;

var pathKey$1 = {exports: {}};

const pathKey = (options = {}) => {
	const environment = options.env || process.env;
	const platform = options.platform || process.platform;

	if (platform !== 'win32') {
		return 'PATH';
	}

	return Object.keys(environment).reverse().find(key => key.toUpperCase() === 'PATH') || 'Path';
};

pathKey$1.exports = pathKey;
// TODO: Remove this for the next major release
pathKey$1.exports.default = pathKey;

var pathKeyExports = pathKey$1.exports;

const path$2 = require$$0$1;
const which = which_1;
const getPathKey = pathKeyExports;

function resolveCommandAttempt(parsed, withoutPathExt) {
    const env = parsed.options.env || process.env;
    const cwd = process.cwd();
    const hasCustomCwd = parsed.options.cwd != null;
    // Worker threads do not have process.chdir()
    const shouldSwitchCwd = hasCustomCwd && process.chdir !== undefined && !process.chdir.disabled;

    // If a custom `cwd` was specified, we need to change the process cwd
    // because `which` will do stat calls but does not support a custom cwd
    if (shouldSwitchCwd) {
        try {
            process.chdir(parsed.options.cwd);
        } catch (err) {
            /* Empty */
        }
    }

    let resolved;

    try {
        resolved = which.sync(parsed.command, {
            path: env[getPathKey({ env })],
            pathExt: withoutPathExt ? path$2.delimiter : undefined,
        });
    } catch (e) {
        /* Empty */
    } finally {
        if (shouldSwitchCwd) {
            process.chdir(cwd);
        }
    }

    // If we successfully resolved, ensure that an absolute path is returned
    // Note that when a custom `cwd` was used, we need to resolve to an absolute path based on it
    if (resolved) {
        resolved = path$2.resolve(hasCustomCwd ? parsed.options.cwd : '', resolved);
    }

    return resolved;
}

function resolveCommand$1(parsed) {
    return resolveCommandAttempt(parsed) || resolveCommandAttempt(parsed, true);
}

var resolveCommand_1 = resolveCommand$1;

var _escape = {};

// See http://www.robvanderwoude.com/escapechars.php
const metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;

function escapeCommand(arg) {
    // Escape meta chars
    arg = arg.replace(metaCharsRegExp, '^$1');

    return arg;
}

function escapeArgument(arg, doubleEscapeMetaChars) {
    // Convert to string
    arg = `${arg}`;

    // Algorithm below is based on https://qntm.org/cmd

    // Sequence of backslashes followed by a double quote:
    // double up all the backslashes and escape the double quote
    arg = arg.replace(/(\\*)"/g, '$1$1\\"');

    // Sequence of backslashes followed by the end of the string
    // (which will become a double quote later):
    // double up all the backslashes
    arg = arg.replace(/(\\*)$/, '$1$1');

    // All other backslashes occur literally

    // Quote the whole thing:
    arg = `"${arg}"`;

    // Escape meta chars
    arg = arg.replace(metaCharsRegExp, '^$1');

    // Double escape meta chars if necessary
    if (doubleEscapeMetaChars) {
        arg = arg.replace(metaCharsRegExp, '^$1');
    }

    return arg;
}

_escape.command = escapeCommand;
_escape.argument = escapeArgument;

var shebangRegex$1 = /^#!(.*)/;

const shebangRegex = shebangRegex$1;

var shebangCommand$1 = (string = '') => {
	const match = string.match(shebangRegex);

	if (!match) {
		return null;
	}

	const [path, argument] = match[0].replace(/#! ?/, '').split(' ');
	const binary = path.split('/').pop();

	if (binary === 'env') {
		return argument;
	}

	return argument ? `${binary} ${argument}` : binary;
};

const fs = require$$0;
const shebangCommand = shebangCommand$1;

function readShebang$1(command) {
    // Read the first 150 bytes from the file
    const size = 150;
    const buffer = Buffer.alloc(size);

    let fd;

    try {
        fd = fs.openSync(command, 'r');
        fs.readSync(fd, buffer, 0, size, 0);
        fs.closeSync(fd);
    } catch (e) { /* Empty */ }

    // Attempt to extract shebang (null is returned if not a shebang)
    return shebangCommand(buffer.toString());
}

var readShebang_1 = readShebang$1;

const path$1 = require$$0$1;
const resolveCommand = resolveCommand_1;
const escape = _escape;
const readShebang = readShebang_1;

const isWin$2 = process.platform === 'win32';
const isExecutableRegExp = /\.(?:com|exe)$/i;
const isCmdShimRegExp = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;

function detectShebang(parsed) {
    parsed.file = resolveCommand(parsed);

    const shebang = parsed.file && readShebang(parsed.file);

    if (shebang) {
        parsed.args.unshift(parsed.file);
        parsed.command = shebang;

        return resolveCommand(parsed);
    }

    return parsed.file;
}

function parseNonShell(parsed) {
    if (!isWin$2) {
        return parsed;
    }

    // Detect & add support for shebangs
    const commandFile = detectShebang(parsed);

    // We don't need a shell if the command filename is an executable
    const needsShell = !isExecutableRegExp.test(commandFile);

    // If a shell is required, use cmd.exe and take care of escaping everything correctly
    // Note that `forceShell` is an hidden option used only in tests
    if (parsed.options.forceShell || needsShell) {
        // Need to double escape meta chars if the command is a cmd-shim located in `node_modules/.bin/`
        // The cmd-shim simply calls execute the package bin file with NodeJS, proxying any argument
        // Because the escape of metachars with ^ gets interpreted when the cmd.exe is first called,
        // we need to double escape them
        const needsDoubleEscapeMetaChars = isCmdShimRegExp.test(commandFile);

        // Normalize posix paths into OS compatible paths (e.g.: foo/bar -> foo\bar)
        // This is necessary otherwise it will always fail with ENOENT in those cases
        parsed.command = path$1.normalize(parsed.command);

        // Escape command & arguments
        parsed.command = escape.command(parsed.command);
        parsed.args = parsed.args.map((arg) => escape.argument(arg, needsDoubleEscapeMetaChars));

        const shellCommand = [parsed.command].concat(parsed.args).join(' ');

        parsed.args = ['/d', '/s', '/c', `"${shellCommand}"`];
        parsed.command = process.env.comspec || 'cmd.exe';
        parsed.options.windowsVerbatimArguments = true; // Tell node's spawn that the arguments are already escaped
    }

    return parsed;
}

function parse$1(command, args, options) {
    // Normalize arguments, similar to nodejs
    if (args && !Array.isArray(args)) {
        options = args;
        args = null;
    }

    args = args ? args.slice(0) : []; // Clone array to avoid changing the original
    options = Object.assign({}, options); // Clone object to avoid changing the original

    // Build our parsed object
    const parsed = {
        command,
        args,
        options,
        file: undefined,
        original: {
            command,
            args,
        },
    };

    // Delegate further parsing to shell or non-shell
    return options.shell ? parsed : parseNonShell(parsed);
}

var parse_1 = parse$1;

const isWin$1 = process.platform === 'win32';

function notFoundError(original, syscall) {
    return Object.assign(new Error(`${syscall} ${original.command} ENOENT`), {
        code: 'ENOENT',
        errno: 'ENOENT',
        syscall: `${syscall} ${original.command}`,
        path: original.command,
        spawnargs: original.args,
    });
}

function hookChildProcess(cp, parsed) {
    if (!isWin$1) {
        return;
    }

    const originalEmit = cp.emit;

    cp.emit = function (name, arg1) {
        // If emitting "exit" event and exit code is 1, we need to check if
        // the command exists and emit an "error" instead
        // See https://github.com/IndigoUnited/node-cross-spawn/issues/16
        if (name === 'exit') {
            const err = verifyENOENT(arg1, parsed);

            if (err) {
                return originalEmit.call(cp, 'error', err);
            }
        }

        return originalEmit.apply(cp, arguments); // eslint-disable-line prefer-rest-params
    };
}

function verifyENOENT(status, parsed) {
    if (isWin$1 && status === 1 && !parsed.file) {
        return notFoundError(parsed.original, 'spawn');
    }

    return null;
}

function verifyENOENTSync(status, parsed) {
    if (isWin$1 && status === 1 && !parsed.file) {
        return notFoundError(parsed.original, 'spawnSync');
    }

    return null;
}

var enoent$1 = {
    hookChildProcess,
    verifyENOENT,
    verifyENOENTSync,
    notFoundError,
};

const cp = require$$0$2;
const parse = parse_1;
const enoent = enoent$1;

function spawn(command, args, options) {
    // Parse the arguments
    const parsed = parse(command, args, options);

    // Spawn the child process
    const spawned = cp.spawn(parsed.command, parsed.args, parsed.options);

    // Hook into child process "exit" event to emit an error if the command
    // does not exists, see: https://github.com/IndigoUnited/node-cross-spawn/issues/16
    enoent.hookChildProcess(spawned, parsed);

    return spawned;
}

function spawnSync(command, args, options) {
    // Parse the arguments
    const parsed = parse(command, args, options);

    // Spawn the child process
    const result = cp.spawnSync(parsed.command, parsed.args, parsed.options);

    // Analyze if the command does not exist, see: https://github.com/IndigoUnited/node-cross-spawn/issues/16
    result.error = result.error || enoent.verifyENOENTSync(result.status, parsed);

    return result;
}

crossSpawn$1.exports = spawn;
crossSpawn$1.exports.spawn = spawn;
crossSpawn$1.exports.sync = spawnSync;

crossSpawn$1.exports._parse = parse;
crossSpawn$1.exports._enoent = enoent;

var crossSpawnExports = crossSpawn$1.exports;

var stripFinalNewline$1 = input => {
	const LF = typeof input === 'string' ? '\n' : '\n'.charCodeAt();
	const CR = typeof input === 'string' ? '\r' : '\r'.charCodeAt();

	if (input[input.length - 1] === LF) {
		input = input.slice(0, input.length - 1);
	}

	if (input[input.length - 1] === CR) {
		input = input.slice(0, input.length - 1);
	}

	return input;
};

var npmRunPath$1 = {exports: {}};

npmRunPath$1.exports;

(function (module) {
	const path = require$$0$1;
	const pathKey = pathKeyExports;

	const npmRunPath = options => {
		options = {
			cwd: process.cwd(),
			path: process.env[pathKey()],
			execPath: process.execPath,
			...options
		};

		let previous;
		let cwdPath = path.resolve(options.cwd);
		const result = [];

		while (previous !== cwdPath) {
			result.push(path.join(cwdPath, 'node_modules/.bin'));
			previous = cwdPath;
			cwdPath = path.resolve(cwdPath, '..');
		}

		// Ensure the running `node` binary is used
		const execPathDir = path.resolve(options.cwd, options.execPath, '..');
		result.push(execPathDir);

		return result.concat(options.path).join(path.delimiter);
	};

	module.exports = npmRunPath;
	// TODO: Remove this for the next major release
	module.exports.default = npmRunPath;

	module.exports.env = options => {
		options = {
			env: process.env,
			...options
		};

		const env = {...options.env};
		const path = pathKey({env});

		options.path = env[path];
		env[path] = module.exports(options);

		return env;
	}; 
} (npmRunPath$1));

var npmRunPathExports = npmRunPath$1.exports;

var onetime$2 = {exports: {}};

var mimicFn$2 = {exports: {}};

const mimicFn$1 = (to, from) => {
	for (const prop of Reflect.ownKeys(from)) {
		Object.defineProperty(to, prop, Object.getOwnPropertyDescriptor(from, prop));
	}

	return to;
};

mimicFn$2.exports = mimicFn$1;
// TODO: Remove this for the next major release
mimicFn$2.exports.default = mimicFn$1;

var mimicFnExports = mimicFn$2.exports;

const mimicFn = mimicFnExports;

const calledFunctions = new WeakMap();

const onetime$1 = (function_, options = {}) => {
	if (typeof function_ !== 'function') {
		throw new TypeError('Expected a function');
	}

	let returnValue;
	let callCount = 0;
	const functionName = function_.displayName || function_.name || '<anonymous>';

	const onetime = function (...arguments_) {
		calledFunctions.set(onetime, ++callCount);

		if (callCount === 1) {
			returnValue = function_.apply(this, arguments_);
			function_ = null;
		} else if (options.throw === true) {
			throw new Error(`Function \`${functionName}\` can only be called once`);
		}

		return returnValue;
	};

	mimicFn(onetime, function_);
	calledFunctions.set(onetime, callCount);

	return onetime;
};

onetime$2.exports = onetime$1;
// TODO: Remove this for the next major release
onetime$2.exports.default = onetime$1;

onetime$2.exports.callCount = function_ => {
	if (!calledFunctions.has(function_)) {
		throw new Error(`The given function \`${function_.name}\` is not wrapped by the \`onetime\` package`);
	}

	return calledFunctions.get(function_);
};

var onetimeExports = onetime$2.exports;

var main = {};

var signals$2 = {};

var core = {};

Object.defineProperty(core,"__esModule",{value:true});core.SIGNALS=void 0;

const SIGNALS=[
{
name:"SIGHUP",
number:1,
action:"terminate",
description:"Terminal closed",
standard:"posix"},

{
name:"SIGINT",
number:2,
action:"terminate",
description:"User interruption with CTRL-C",
standard:"ansi"},

{
name:"SIGQUIT",
number:3,
action:"core",
description:"User interruption with CTRL-\\",
standard:"posix"},

{
name:"SIGILL",
number:4,
action:"core",
description:"Invalid machine instruction",
standard:"ansi"},

{
name:"SIGTRAP",
number:5,
action:"core",
description:"Debugger breakpoint",
standard:"posix"},

{
name:"SIGABRT",
number:6,
action:"core",
description:"Aborted",
standard:"ansi"},

{
name:"SIGIOT",
number:6,
action:"core",
description:"Aborted",
standard:"bsd"},

{
name:"SIGBUS",
number:7,
action:"core",
description:
"Bus error due to misaligned, non-existing address or paging error",
standard:"bsd"},

{
name:"SIGEMT",
number:7,
action:"terminate",
description:"Command should be emulated but is not implemented",
standard:"other"},

{
name:"SIGFPE",
number:8,
action:"core",
description:"Floating point arithmetic error",
standard:"ansi"},

{
name:"SIGKILL",
number:9,
action:"terminate",
description:"Forced termination",
standard:"posix",
forced:true},

{
name:"SIGUSR1",
number:10,
action:"terminate",
description:"Application-specific signal",
standard:"posix"},

{
name:"SIGSEGV",
number:11,
action:"core",
description:"Segmentation fault",
standard:"ansi"},

{
name:"SIGUSR2",
number:12,
action:"terminate",
description:"Application-specific signal",
standard:"posix"},

{
name:"SIGPIPE",
number:13,
action:"terminate",
description:"Broken pipe or socket",
standard:"posix"},

{
name:"SIGALRM",
number:14,
action:"terminate",
description:"Timeout or timer",
standard:"posix"},

{
name:"SIGTERM",
number:15,
action:"terminate",
description:"Termination",
standard:"ansi"},

{
name:"SIGSTKFLT",
number:16,
action:"terminate",
description:"Stack is empty or overflowed",
standard:"other"},

{
name:"SIGCHLD",
number:17,
action:"ignore",
description:"Child process terminated, paused or unpaused",
standard:"posix"},

{
name:"SIGCLD",
number:17,
action:"ignore",
description:"Child process terminated, paused or unpaused",
standard:"other"},

{
name:"SIGCONT",
number:18,
action:"unpause",
description:"Unpaused",
standard:"posix",
forced:true},

{
name:"SIGSTOP",
number:19,
action:"pause",
description:"Paused",
standard:"posix",
forced:true},

{
name:"SIGTSTP",
number:20,
action:"pause",
description:"Paused using CTRL-Z or \"suspend\"",
standard:"posix"},

{
name:"SIGTTIN",
number:21,
action:"pause",
description:"Background process cannot read terminal input",
standard:"posix"},

{
name:"SIGBREAK",
number:21,
action:"terminate",
description:"User interruption with CTRL-BREAK",
standard:"other"},

{
name:"SIGTTOU",
number:22,
action:"pause",
description:"Background process cannot write to terminal output",
standard:"posix"},

{
name:"SIGURG",
number:23,
action:"ignore",
description:"Socket received out-of-band data",
standard:"bsd"},

{
name:"SIGXCPU",
number:24,
action:"core",
description:"Process timed out",
standard:"bsd"},

{
name:"SIGXFSZ",
number:25,
action:"core",
description:"File too big",
standard:"bsd"},

{
name:"SIGVTALRM",
number:26,
action:"terminate",
description:"Timeout or timer",
standard:"bsd"},

{
name:"SIGPROF",
number:27,
action:"terminate",
description:"Timeout or timer",
standard:"bsd"},

{
name:"SIGWINCH",
number:28,
action:"ignore",
description:"Terminal window size changed",
standard:"bsd"},

{
name:"SIGIO",
number:29,
action:"terminate",
description:"I/O is available",
standard:"other"},

{
name:"SIGPOLL",
number:29,
action:"terminate",
description:"Watched event",
standard:"other"},

{
name:"SIGINFO",
number:29,
action:"ignore",
description:"Request for process information",
standard:"other"},

{
name:"SIGPWR",
number:30,
action:"terminate",
description:"Device running out of power",
standard:"systemv"},

{
name:"SIGSYS",
number:31,
action:"core",
description:"Invalid system call",
standard:"other"},

{
name:"SIGUNUSED",
number:31,
action:"terminate",
description:"Invalid system call",
standard:"other"}];core.SIGNALS=SIGNALS;

var realtime = {};

Object.defineProperty(realtime,"__esModule",{value:true});realtime.SIGRTMAX=realtime.getRealtimeSignals=void 0;
const getRealtimeSignals=function(){
const length=SIGRTMAX-SIGRTMIN+1;
return Array.from({length},getRealtimeSignal);
};realtime.getRealtimeSignals=getRealtimeSignals;

const getRealtimeSignal=function(value,index){
return {
name:`SIGRT${index+1}`,
number:SIGRTMIN+index,
action:"terminate",
description:"Application-specific signal (realtime)",
standard:"posix"};

};

const SIGRTMIN=34;
const SIGRTMAX=64;realtime.SIGRTMAX=SIGRTMAX;

Object.defineProperty(signals$2,"__esModule",{value:true});signals$2.getSignals=void 0;var _os$1=require$$0$3;

var _core=core;
var _realtime$1=realtime;



const getSignals=function(){
const realtimeSignals=(0, _realtime$1.getRealtimeSignals)();
const signals=[..._core.SIGNALS,...realtimeSignals].map(normalizeSignal);
return signals;
};signals$2.getSignals=getSignals;







const normalizeSignal=function({
name,
number:defaultNumber,
description,
action,
forced=false,
standard})
{
const{
signals:{[name]:constantSignal}}=
_os$1.constants;
const supported=constantSignal!==undefined;
const number=supported?constantSignal:defaultNumber;
return {name,number,description,supported,action,forced,standard};
};

Object.defineProperty(main,"__esModule",{value:true});main.signalsByNumber=main.signalsByName=void 0;var _os=require$$0$3;

var _signals=signals$2;
var _realtime=realtime;



const getSignalsByName=function(){
const signals=(0, _signals.getSignals)();
return signals.reduce(getSignalByName,{});
};

const getSignalByName=function(
signalByNameMemo,
{name,number,description,supported,action,forced,standard})
{
return {
...signalByNameMemo,
[name]:{name,number,description,supported,action,forced,standard}};

};

const signalsByName$1=getSignalsByName();main.signalsByName=signalsByName$1;




const getSignalsByNumber=function(){
const signals=(0, _signals.getSignals)();
const length=_realtime.SIGRTMAX+1;
const signalsA=Array.from({length},(value,number)=>
getSignalByNumber(number,signals));

return Object.assign({},...signalsA);
};

const getSignalByNumber=function(number,signals){
const signal=findSignalByNumber(number,signals);

if(signal===undefined){
return {};
}

const{name,description,supported,action,forced,standard}=signal;
return {
[number]:{
name,
number,
description,
supported,
action,
forced,
standard}};


};



const findSignalByNumber=function(number,signals){
const signal=signals.find(({name})=>_os.constants.signals[name]===number);

if(signal!==undefined){
return signal;
}

return signals.find(signalA=>signalA.number===number);
};

const signalsByNumber=getSignalsByNumber();main.signalsByNumber=signalsByNumber;

const {signalsByName} = main;

const getErrorPrefix = ({timedOut, timeout, errorCode, signal, signalDescription, exitCode, isCanceled}) => {
	if (timedOut) {
		return `timed out after ${timeout} milliseconds`;
	}

	if (isCanceled) {
		return 'was canceled';
	}

	if (errorCode !== undefined) {
		return `failed with ${errorCode}`;
	}

	if (signal !== undefined) {
		return `was killed with ${signal} (${signalDescription})`;
	}

	if (exitCode !== undefined) {
		return `failed with exit code ${exitCode}`;
	}

	return 'failed';
};

const makeError$1 = ({
	stdout,
	stderr,
	all,
	error,
	signal,
	exitCode,
	command,
	escapedCommand,
	timedOut,
	isCanceled,
	killed,
	parsed: {options: {timeout}}
}) => {
	// `signal` and `exitCode` emitted on `spawned.on('exit')` event can be `null`.
	// We normalize them to `undefined`
	exitCode = exitCode === null ? undefined : exitCode;
	signal = signal === null ? undefined : signal;
	const signalDescription = signal === undefined ? undefined : signalsByName[signal].description;

	const errorCode = error && error.code;

	const prefix = getErrorPrefix({timedOut, timeout, errorCode, signal, signalDescription, exitCode, isCanceled});
	const execaMessage = `Command ${prefix}: ${command}`;
	const isError = Object.prototype.toString.call(error) === '[object Error]';
	const shortMessage = isError ? `${execaMessage}\n${error.message}` : execaMessage;
	const message = [shortMessage, stderr, stdout].filter(Boolean).join('\n');

	if (isError) {
		error.originalMessage = error.message;
		error.message = message;
	} else {
		error = new Error(message);
	}

	error.shortMessage = shortMessage;
	error.command = command;
	error.escapedCommand = escapedCommand;
	error.exitCode = exitCode;
	error.signal = signal;
	error.signalDescription = signalDescription;
	error.stdout = stdout;
	error.stderr = stderr;

	if (all !== undefined) {
		error.all = all;
	}

	if ('bufferedData' in error) {
		delete error.bufferedData;
	}

	error.failed = true;
	error.timedOut = Boolean(timedOut);
	error.isCanceled = isCanceled;
	error.killed = killed && !timedOut;

	return error;
};

var error = makeError$1;

var stdio = {exports: {}};

const aliases = ['stdin', 'stdout', 'stderr'];

const hasAlias = options => aliases.some(alias => options[alias] !== undefined);

const normalizeStdio$1 = options => {
	if (!options) {
		return;
	}

	const {stdio} = options;

	if (stdio === undefined) {
		return aliases.map(alias => options[alias]);
	}

	if (hasAlias(options)) {
		throw new Error(`It's not possible to provide \`stdio\` in combination with one of ${aliases.map(alias => `\`${alias}\``).join(', ')}`);
	}

	if (typeof stdio === 'string') {
		return stdio;
	}

	if (!Array.isArray(stdio)) {
		throw new TypeError(`Expected \`stdio\` to be of type \`string\` or \`Array\`, got \`${typeof stdio}\``);
	}

	const length = Math.max(stdio.length, aliases.length);
	return Array.from({length}, (value, index) => stdio[index]);
};

stdio.exports = normalizeStdio$1;

// `ipc` is pushed unless it is already present
stdio.exports.node = options => {
	const stdio = normalizeStdio$1(options);

	if (stdio === 'ipc') {
		return 'ipc';
	}

	if (stdio === undefined || typeof stdio === 'string') {
		return [stdio, stdio, stdio, 'ipc'];
	}

	if (stdio.includes('ipc')) {
		return stdio;
	}

	return [...stdio, 'ipc'];
};

var stdioExports = stdio.exports;

var signalExit = {exports: {}};

var signals$1 = {exports: {}};

var hasRequiredSignals;

function requireSignals () {
	if (hasRequiredSignals) return signals$1.exports;
	hasRequiredSignals = 1;
	(function (module) {
		// This is not the set of all possible signals.
		//
		// It IS, however, the set of all signals that trigger
		// an exit on either Linux or BSD systems.  Linux is a
		// superset of the signal names supported on BSD, and
		// the unknown signals just fail to register, so we can
		// catch that easily enough.
		//
		// Don't bother with SIGKILL.  It's uncatchable, which
		// means that we can't fire any callbacks anyway.
		//
		// If a user does happen to register a handler on a non-
		// fatal signal like SIGWINCH or something, and then
		// exit, it'll end up firing `process.emit('exit')`, so
		// the handler will be fired anyway.
		//
		// SIGBUS, SIGFPE, SIGSEGV and SIGILL, when not raised
		// artificially, inherently leave the process in a
		// state from which it is not safe to try and enter JS
		// listeners.
		module.exports = [
		  'SIGABRT',
		  'SIGALRM',
		  'SIGHUP',
		  'SIGINT',
		  'SIGTERM'
		];

		if (process.platform !== 'win32') {
		  module.exports.push(
		    'SIGVTALRM',
		    'SIGXCPU',
		    'SIGXFSZ',
		    'SIGUSR2',
		    'SIGTRAP',
		    'SIGSYS',
		    'SIGQUIT',
		    'SIGIOT'
		    // should detect profiler and enable/disable accordingly.
		    // see #21
		    // 'SIGPROF'
		  );
		}

		if (process.platform === 'linux') {
		  module.exports.push(
		    'SIGIO',
		    'SIGPOLL',
		    'SIGPWR',
		    'SIGSTKFLT',
		    'SIGUNUSED'
		  );
		} 
	} (signals$1));
	return signals$1.exports;
}

// Note: since nyc uses this module to output coverage, any lines
// that are in the direct sync flow of nyc's outputCoverage are
// ignored, since we can never get coverage for them.
// grab a reference to node's real process object right away
var process$1 = commonjsGlobal.process;

const processOk = function (process) {
  return process &&
    typeof process === 'object' &&
    typeof process.removeListener === 'function' &&
    typeof process.emit === 'function' &&
    typeof process.reallyExit === 'function' &&
    typeof process.listeners === 'function' &&
    typeof process.kill === 'function' &&
    typeof process.pid === 'number' &&
    typeof process.on === 'function'
};

// some kind of non-node environment, just no-op
/* istanbul ignore if */
if (!processOk(process$1)) {
  signalExit.exports = function () {
    return function () {}
  };
} else {
  var assert = require$$0$4;
  var signals = requireSignals();
  var isWin = /^win/i.test(process$1.platform);

  var EE = require$$2;
  /* istanbul ignore if */
  if (typeof EE !== 'function') {
    EE = EE.EventEmitter;
  }

  var emitter;
  if (process$1.__signal_exit_emitter__) {
    emitter = process$1.__signal_exit_emitter__;
  } else {
    emitter = process$1.__signal_exit_emitter__ = new EE();
    emitter.count = 0;
    emitter.emitted = {};
  }

  // Because this emitter is a global, we have to check to see if a
  // previous version of this library failed to enable infinite listeners.
  // I know what you're about to say.  But literally everything about
  // signal-exit is a compromise with evil.  Get used to it.
  if (!emitter.infinite) {
    emitter.setMaxListeners(Infinity);
    emitter.infinite = true;
  }

  signalExit.exports = function (cb, opts) {
    /* istanbul ignore if */
    if (!processOk(commonjsGlobal.process)) {
      return function () {}
    }
    assert.equal(typeof cb, 'function', 'a callback must be provided for exit handler');

    if (loaded === false) {
      load();
    }

    var ev = 'exit';
    if (opts && opts.alwaysLast) {
      ev = 'afterexit';
    }

    var remove = function () {
      emitter.removeListener(ev, cb);
      if (emitter.listeners('exit').length === 0 &&
          emitter.listeners('afterexit').length === 0) {
        unload();
      }
    };
    emitter.on(ev, cb);

    return remove
  };

  var unload = function unload () {
    if (!loaded || !processOk(commonjsGlobal.process)) {
      return
    }
    loaded = false;

    signals.forEach(function (sig) {
      try {
        process$1.removeListener(sig, sigListeners[sig]);
      } catch (er) {}
    });
    process$1.emit = originalProcessEmit;
    process$1.reallyExit = originalProcessReallyExit;
    emitter.count -= 1;
  };
  signalExit.exports.unload = unload;

  var emit = function emit (event, code, signal) {
    /* istanbul ignore if */
    if (emitter.emitted[event]) {
      return
    }
    emitter.emitted[event] = true;
    emitter.emit(event, code, signal);
  };

  // { <signal>: <listener fn>, ... }
  var sigListeners = {};
  signals.forEach(function (sig) {
    sigListeners[sig] = function listener () {
      /* istanbul ignore if */
      if (!processOk(commonjsGlobal.process)) {
        return
      }
      // If there are no other listeners, an exit is coming!
      // Simplest way: remove us and then re-send the signal.
      // We know that this will kill the process, so we can
      // safely emit now.
      var listeners = process$1.listeners(sig);
      if (listeners.length === emitter.count) {
        unload();
        emit('exit', null, sig);
        /* istanbul ignore next */
        emit('afterexit', null, sig);
        /* istanbul ignore next */
        if (isWin && sig === 'SIGHUP') {
          // "SIGHUP" throws an `ENOSYS` error on Windows,
          // so use a supported signal instead
          sig = 'SIGINT';
        }
        /* istanbul ignore next */
        process$1.kill(process$1.pid, sig);
      }
    };
  });

  signalExit.exports.signals = function () {
    return signals
  };

  var loaded = false;

  var load = function load () {
    if (loaded || !processOk(commonjsGlobal.process)) {
      return
    }
    loaded = true;

    // This is the number of onSignalExit's that are in play.
    // It's important so that we can count the correct number of
    // listeners on signals, and don't wait for the other one to
    // handle it instead of us.
    emitter.count += 1;

    signals = signals.filter(function (sig) {
      try {
        process$1.on(sig, sigListeners[sig]);
        return true
      } catch (er) {
        return false
      }
    });

    process$1.emit = processEmit;
    process$1.reallyExit = processReallyExit;
  };
  signalExit.exports.load = load;

  var originalProcessReallyExit = process$1.reallyExit;
  var processReallyExit = function processReallyExit (code) {
    /* istanbul ignore if */
    if (!processOk(commonjsGlobal.process)) {
      return
    }
    process$1.exitCode = code || /* istanbul ignore next */ 0;
    emit('exit', process$1.exitCode, null);
    /* istanbul ignore next */
    emit('afterexit', process$1.exitCode, null);
    /* istanbul ignore next */
    originalProcessReallyExit.call(process$1, process$1.exitCode);
  };

  var originalProcessEmit = process$1.emit;
  var processEmit = function processEmit (ev, arg) {
    if (ev === 'exit' && processOk(commonjsGlobal.process)) {
      /* istanbul ignore else */
      if (arg !== undefined) {
        process$1.exitCode = arg;
      }
      var ret = originalProcessEmit.apply(this, arguments);
      /* istanbul ignore next */
      emit('exit', process$1.exitCode, null);
      /* istanbul ignore next */
      emit('afterexit', process$1.exitCode, null);
      /* istanbul ignore next */
      return ret
    } else {
      return originalProcessEmit.apply(this, arguments)
    }
  };
}

var signalExitExports = signalExit.exports;

const os = require$$0$3;
const onExit = signalExitExports;

const DEFAULT_FORCE_KILL_TIMEOUT = 1000 * 5;

// Monkey-patches `childProcess.kill()` to add `forceKillAfterTimeout` behavior
const spawnedKill$1 = (kill, signal = 'SIGTERM', options = {}) => {
	const killResult = kill(signal);
	setKillTimeout(kill, signal, options, killResult);
	return killResult;
};

const setKillTimeout = (kill, signal, options, killResult) => {
	if (!shouldForceKill(signal, options, killResult)) {
		return;
	}

	const timeout = getForceKillAfterTimeout(options);
	const t = setTimeout(() => {
		kill('SIGKILL');
	}, timeout);

	// Guarded because there's no `.unref()` when `execa` is used in the renderer
	// process in Electron. This cannot be tested since we don't run tests in
	// Electron.
	// istanbul ignore else
	if (t.unref) {
		t.unref();
	}
};

const shouldForceKill = (signal, {forceKillAfterTimeout}, killResult) => {
	return isSigterm(signal) && forceKillAfterTimeout !== false && killResult;
};

const isSigterm = signal => {
	return signal === os.constants.signals.SIGTERM ||
		(typeof signal === 'string' && signal.toUpperCase() === 'SIGTERM');
};

const getForceKillAfterTimeout = ({forceKillAfterTimeout = true}) => {
	if (forceKillAfterTimeout === true) {
		return DEFAULT_FORCE_KILL_TIMEOUT;
	}

	if (!Number.isFinite(forceKillAfterTimeout) || forceKillAfterTimeout < 0) {
		throw new TypeError(`Expected the \`forceKillAfterTimeout\` option to be a non-negative integer, got \`${forceKillAfterTimeout}\` (${typeof forceKillAfterTimeout})`);
	}

	return forceKillAfterTimeout;
};

// `childProcess.cancel()`
const spawnedCancel$1 = (spawned, context) => {
	const killResult = spawned.kill();

	if (killResult) {
		context.isCanceled = true;
	}
};

const timeoutKill = (spawned, signal, reject) => {
	spawned.kill(signal);
	reject(Object.assign(new Error('Timed out'), {timedOut: true, signal}));
};

// `timeout` option handling
const setupTimeout$1 = (spawned, {timeout, killSignal = 'SIGTERM'}, spawnedPromise) => {
	if (timeout === 0 || timeout === undefined) {
		return spawnedPromise;
	}

	let timeoutId;
	const timeoutPromise = new Promise((resolve, reject) => {
		timeoutId = setTimeout(() => {
			timeoutKill(spawned, killSignal, reject);
		}, timeout);
	});

	const safeSpawnedPromise = spawnedPromise.finally(() => {
		clearTimeout(timeoutId);
	});

	return Promise.race([timeoutPromise, safeSpawnedPromise]);
};

const validateTimeout$1 = ({timeout}) => {
	if (timeout !== undefined && (!Number.isFinite(timeout) || timeout < 0)) {
		throw new TypeError(`Expected the \`timeout\` option to be a non-negative integer, got \`${timeout}\` (${typeof timeout})`);
	}
};

// `cleanup` option handling
const setExitHandler$1 = async (spawned, {cleanup, detached}, timedPromise) => {
	if (!cleanup || detached) {
		return timedPromise;
	}

	const removeExitHandler = onExit(() => {
		spawned.kill();
	});

	return timedPromise.finally(() => {
		removeExitHandler();
	});
};

var kill = {
	spawnedKill: spawnedKill$1,
	spawnedCancel: spawnedCancel$1,
	setupTimeout: setupTimeout$1,
	validateTimeout: validateTimeout$1,
	setExitHandler: setExitHandler$1
};

const isStream$1 = stream =>
	stream !== null &&
	typeof stream === 'object' &&
	typeof stream.pipe === 'function';

isStream$1.writable = stream =>
	isStream$1(stream) &&
	stream.writable !== false &&
	typeof stream._write === 'function' &&
	typeof stream._writableState === 'object';

isStream$1.readable = stream =>
	isStream$1(stream) &&
	stream.readable !== false &&
	typeof stream._read === 'function' &&
	typeof stream._readableState === 'object';

isStream$1.duplex = stream =>
	isStream$1.writable(stream) &&
	isStream$1.readable(stream);

isStream$1.transform = stream =>
	isStream$1.duplex(stream) &&
	typeof stream._transform === 'function';

var isStream_1 = isStream$1;

var getStream$2 = {exports: {}};

const {PassThrough: PassThroughStream} = require$$0$5;

var bufferStream$1 = options => {
	options = {...options};

	const {array} = options;
	let {encoding} = options;
	const isBuffer = encoding === 'buffer';
	let objectMode = false;

	if (array) {
		objectMode = !(encoding || isBuffer);
	} else {
		encoding = encoding || 'utf8';
	}

	if (isBuffer) {
		encoding = null;
	}

	const stream = new PassThroughStream({objectMode});

	if (encoding) {
		stream.setEncoding(encoding);
	}

	let length = 0;
	const chunks = [];

	stream.on('data', chunk => {
		chunks.push(chunk);

		if (objectMode) {
			length = chunks.length;
		} else {
			length += chunk.length;
		}
	});

	stream.getBufferedValue = () => {
		if (array) {
			return chunks;
		}

		return isBuffer ? Buffer.concat(chunks, length) : chunks.join('');
	};

	stream.getBufferedLength = () => length;

	return stream;
};

const {constants: BufferConstants} = require$$0$6;
const stream$1 = require$$0$5;
const {promisify} = require$$2$1;
const bufferStream = bufferStream$1;

const streamPipelinePromisified = promisify(stream$1.pipeline);

class MaxBufferError extends Error {
	constructor() {
		super('maxBuffer exceeded');
		this.name = 'MaxBufferError';
	}
}

async function getStream$1(inputStream, options) {
	if (!inputStream) {
		throw new Error('Expected a stream');
	}

	options = {
		maxBuffer: Infinity,
		...options
	};

	const {maxBuffer} = options;
	const stream = bufferStream(options);

	await new Promise((resolve, reject) => {
		const rejectPromise = error => {
			// Don't retrieve an oversized buffer.
			if (error && stream.getBufferedLength() <= BufferConstants.MAX_LENGTH) {
				error.bufferedData = stream.getBufferedValue();
			}

			reject(error);
		};

		(async () => {
			try {
				await streamPipelinePromisified(inputStream, stream);
				resolve();
			} catch (error) {
				rejectPromise(error);
			}
		})();

		stream.on('data', () => {
			if (stream.getBufferedLength() > maxBuffer) {
				rejectPromise(new MaxBufferError());
			}
		});
	});

	return stream.getBufferedValue();
}

getStream$2.exports = getStream$1;
getStream$2.exports.buffer = (stream, options) => getStream$1(stream, {...options, encoding: 'buffer'});
getStream$2.exports.array = (stream, options) => getStream$1(stream, {...options, array: true});
getStream$2.exports.MaxBufferError = MaxBufferError;

var getStreamExports = getStream$2.exports;

const { PassThrough } = require$$0$5;

var mergeStream$1 = function (/*streams...*/) {
  var sources = [];
  var output  = new PassThrough({objectMode: true});

  output.setMaxListeners(0);

  output.add = add;
  output.isEmpty = isEmpty;

  output.on('unpipe', remove);

  Array.prototype.slice.call(arguments).forEach(add);

  return output

  function add (source) {
    if (Array.isArray(source)) {
      source.forEach(add);
      return this
    }

    sources.push(source);
    source.once('end', remove.bind(null, source));
    source.once('error', output.emit.bind(output, 'error'));
    source.pipe(output, {end: false});
    return this
  }

  function isEmpty () {
    return sources.length == 0;
  }

  function remove (source) {
    sources = sources.filter(function (it) { return it !== source });
    if (!sources.length && output.readable) { output.end(); }
  }
};

const isStream = isStream_1;
const getStream = getStreamExports;
const mergeStream = mergeStream$1;

// `input` option
const handleInput$1 = (spawned, input) => {
	// Checking for stdin is workaround for https://github.com/nodejs/node/issues/26852
	// @todo remove `|| spawned.stdin === undefined` once we drop support for Node.js <=12.2.0
	if (input === undefined || spawned.stdin === undefined) {
		return;
	}

	if (isStream(input)) {
		input.pipe(spawned.stdin);
	} else {
		spawned.stdin.end(input);
	}
};

// `all` interleaves `stdout` and `stderr`
const makeAllStream$1 = (spawned, {all}) => {
	if (!all || (!spawned.stdout && !spawned.stderr)) {
		return;
	}

	const mixed = mergeStream();

	if (spawned.stdout) {
		mixed.add(spawned.stdout);
	}

	if (spawned.stderr) {
		mixed.add(spawned.stderr);
	}

	return mixed;
};

// On failure, `result.stdout|stderr|all` should contain the currently buffered stream
const getBufferedData = async (stream, streamPromise) => {
	if (!stream) {
		return;
	}

	stream.destroy();

	try {
		return await streamPromise;
	} catch (error) {
		return error.bufferedData;
	}
};

const getStreamPromise = (stream, {encoding, buffer, maxBuffer}) => {
	if (!stream || !buffer) {
		return;
	}

	if (encoding) {
		return getStream(stream, {encoding, maxBuffer});
	}

	return getStream.buffer(stream, {maxBuffer});
};

// Retrieve result of child process: exit code, signal, error, streams (stdout/stderr/all)
const getSpawnedResult$1 = async ({stdout, stderr, all}, {encoding, buffer, maxBuffer}, processDone) => {
	const stdoutPromise = getStreamPromise(stdout, {encoding, buffer, maxBuffer});
	const stderrPromise = getStreamPromise(stderr, {encoding, buffer, maxBuffer});
	const allPromise = getStreamPromise(all, {encoding, buffer, maxBuffer: maxBuffer * 2});

	try {
		return await Promise.all([processDone, stdoutPromise, stderrPromise, allPromise]);
	} catch (error) {
		return Promise.all([
			{error, signal: error.signal, timedOut: error.timedOut},
			getBufferedData(stdout, stdoutPromise),
			getBufferedData(stderr, stderrPromise),
			getBufferedData(all, allPromise)
		]);
	}
};

const validateInputSync$1 = ({input}) => {
	if (isStream(input)) {
		throw new TypeError('The `input` option cannot be a stream in sync mode');
	}
};

var stream = {
	handleInput: handleInput$1,
	makeAllStream: makeAllStream$1,
	getSpawnedResult: getSpawnedResult$1,
	validateInputSync: validateInputSync$1
};

const nativePromisePrototype = (async () => {})().constructor.prototype;
const descriptors = ['then', 'catch', 'finally'].map(property => [
	property,
	Reflect.getOwnPropertyDescriptor(nativePromisePrototype, property)
]);

// The return value is a mixin of `childProcess` and `Promise`
const mergePromise$1 = (spawned, promise) => {
	for (const [property, descriptor] of descriptors) {
		// Starting the main `promise` is deferred to avoid consuming streams
		const value = typeof promise === 'function' ?
			(...args) => Reflect.apply(descriptor.value, promise(), args) :
			descriptor.value.bind(promise);

		Reflect.defineProperty(spawned, property, {...descriptor, value});
	}

	return spawned;
};

// Use promises instead of `child_process` events
const getSpawnedPromise$1 = spawned => {
	return new Promise((resolve, reject) => {
		spawned.on('exit', (exitCode, signal) => {
			resolve({exitCode, signal});
		});

		spawned.on('error', error => {
			reject(error);
		});

		if (spawned.stdin) {
			spawned.stdin.on('error', error => {
				reject(error);
			});
		}
	});
};

var promise = {
	mergePromise: mergePromise$1,
	getSpawnedPromise: getSpawnedPromise$1
};

const normalizeArgs = (file, args = []) => {
	if (!Array.isArray(args)) {
		return [file];
	}

	return [file, ...args];
};

const NO_ESCAPE_REGEXP = /^[\w.-]+$/;
const DOUBLE_QUOTES_REGEXP = /"/g;

const escapeArg = arg => {
	if (typeof arg !== 'string' || NO_ESCAPE_REGEXP.test(arg)) {
		return arg;
	}

	return `"${arg.replace(DOUBLE_QUOTES_REGEXP, '\\"')}"`;
};

const joinCommand$1 = (file, args) => {
	return normalizeArgs(file, args).join(' ');
};

const getEscapedCommand$1 = (file, args) => {
	return normalizeArgs(file, args).map(arg => escapeArg(arg)).join(' ');
};

const SPACES_REGEXP = / +/g;

// Handle `execa.command()`
const parseCommand$1 = command => {
	const tokens = [];
	for (const token of command.trim().split(SPACES_REGEXP)) {
		// Allow spaces to be escaped by a backslash if not meant as a delimiter
		const previousToken = tokens[tokens.length - 1];
		if (previousToken && previousToken.endsWith('\\')) {
			// Merge previous token with current one
			tokens[tokens.length - 1] = `${previousToken.slice(0, -1)} ${token}`;
		} else {
			tokens.push(token);
		}
	}

	return tokens;
};

var command = {
	joinCommand: joinCommand$1,
	getEscapedCommand: getEscapedCommand$1,
	parseCommand: parseCommand$1
};

const path = require$$0$1;
const childProcess = require$$0$2;
const crossSpawn = crossSpawnExports;
const stripFinalNewline = stripFinalNewline$1;
const npmRunPath = npmRunPathExports;
const onetime = onetimeExports;
const makeError = error;
const normalizeStdio = stdioExports;
const {spawnedKill, spawnedCancel, setupTimeout, validateTimeout, setExitHandler} = kill;
const {handleInput, getSpawnedResult, makeAllStream, validateInputSync} = stream;
const {mergePromise, getSpawnedPromise} = promise;
const {joinCommand, parseCommand, getEscapedCommand} = command;

const DEFAULT_MAX_BUFFER = 1000 * 1000 * 100;

const getEnv = ({env: envOption, extendEnv, preferLocal, localDir, execPath}) => {
	const env = extendEnv ? {...process.env, ...envOption} : envOption;

	if (preferLocal) {
		return npmRunPath.env({env, cwd: localDir, execPath});
	}

	return env;
};

const handleArguments = (file, args, options = {}) => {
	const parsed = crossSpawn._parse(file, args, options);
	file = parsed.command;
	args = parsed.args;
	options = parsed.options;

	options = {
		maxBuffer: DEFAULT_MAX_BUFFER,
		buffer: true,
		stripFinalNewline: true,
		extendEnv: true,
		preferLocal: false,
		localDir: options.cwd || process.cwd(),
		execPath: process.execPath,
		encoding: 'utf8',
		reject: true,
		cleanup: true,
		all: false,
		windowsHide: true,
		...options
	};

	options.env = getEnv(options);

	options.stdio = normalizeStdio(options);

	if (process.platform === 'win32' && path.basename(file, '.exe') === 'cmd') {
		// #116
		args.unshift('/q');
	}

	return {file, args, options, parsed};
};

const handleOutput = (options, value, error) => {
	if (typeof value !== 'string' && !Buffer.isBuffer(value)) {
		// When `execa.sync()` errors, we normalize it to '' to mimic `execa()`
		return error === undefined ? undefined : '';
	}

	if (options.stripFinalNewline) {
		return stripFinalNewline(value);
	}

	return value;
};

const execa = (file, args, options) => {
	const parsed = handleArguments(file, args, options);
	const command = joinCommand(file, args);
	const escapedCommand = getEscapedCommand(file, args);

	validateTimeout(parsed.options);

	let spawned;
	try {
		spawned = childProcess.spawn(parsed.file, parsed.args, parsed.options);
	} catch (error) {
		// Ensure the returned error is always both a promise and a child process
		const dummySpawned = new childProcess.ChildProcess();
		const errorPromise = Promise.reject(makeError({
			error,
			stdout: '',
			stderr: '',
			all: '',
			command,
			escapedCommand,
			parsed,
			timedOut: false,
			isCanceled: false,
			killed: false
		}));
		return mergePromise(dummySpawned, errorPromise);
	}

	const spawnedPromise = getSpawnedPromise(spawned);
	const timedPromise = setupTimeout(spawned, parsed.options, spawnedPromise);
	const processDone = setExitHandler(spawned, parsed.options, timedPromise);

	const context = {isCanceled: false};

	spawned.kill = spawnedKill.bind(null, spawned.kill.bind(spawned));
	spawned.cancel = spawnedCancel.bind(null, spawned, context);

	const handlePromise = async () => {
		const [{error, exitCode, signal, timedOut}, stdoutResult, stderrResult, allResult] = await getSpawnedResult(spawned, parsed.options, processDone);
		const stdout = handleOutput(parsed.options, stdoutResult);
		const stderr = handleOutput(parsed.options, stderrResult);
		const all = handleOutput(parsed.options, allResult);

		if (error || exitCode !== 0 || signal !== null) {
			const returnedError = makeError({
				error,
				exitCode,
				signal,
				stdout,
				stderr,
				all,
				command,
				escapedCommand,
				parsed,
				timedOut,
				isCanceled: context.isCanceled,
				killed: spawned.killed
			});

			if (!parsed.options.reject) {
				return returnedError;
			}

			throw returnedError;
		}

		return {
			command,
			escapedCommand,
			exitCode: 0,
			stdout,
			stderr,
			all,
			failed: false,
			timedOut: false,
			isCanceled: false,
			killed: false
		};
	};

	const handlePromiseOnce = onetime(handlePromise);

	handleInput(spawned, parsed.options.input);

	spawned.all = makeAllStream(spawned, parsed.options);

	return mergePromise(spawned, handlePromiseOnce);
};

execa$2.exports = execa;

execa$2.exports.sync = (file, args, options) => {
	const parsed = handleArguments(file, args, options);
	const command = joinCommand(file, args);
	const escapedCommand = getEscapedCommand(file, args);

	validateInputSync(parsed.options);

	let result;
	try {
		result = childProcess.spawnSync(parsed.file, parsed.args, parsed.options);
	} catch (error) {
		throw makeError({
			error,
			stdout: '',
			stderr: '',
			all: '',
			command,
			escapedCommand,
			parsed,
			timedOut: false,
			isCanceled: false,
			killed: false
		});
	}

	const stdout = handleOutput(parsed.options, result.stdout, result.error);
	const stderr = handleOutput(parsed.options, result.stderr, result.error);

	if (result.error || result.status !== 0 || result.signal !== null) {
		const error = makeError({
			stdout,
			stderr,
			error: result.error,
			signal: result.signal,
			exitCode: result.status,
			command,
			escapedCommand,
			parsed,
			timedOut: result.error && result.error.code === 'ETIMEDOUT',
			isCanceled: false,
			killed: result.signal !== null
		});

		if (!parsed.options.reject) {
			return error;
		}

		throw error;
	}

	return {
		command,
		escapedCommand,
		exitCode: 0,
		stdout,
		stderr,
		failed: false,
		timedOut: false,
		isCanceled: false,
		killed: false
	};
};

execa$2.exports.command = (command, options) => {
	const [file, ...args] = parseCommand(command);
	return execa(file, args, options);
};

execa$2.exports.commandSync = (command, options) => {
	const [file, ...args] = parseCommand(command);
	return execa.sync(file, args, options);
};

execa$2.exports.node = (scriptPath, args, options = {}) => {
	if (args && !Array.isArray(args) && typeof args === 'object') {
		options = args;
		args = [];
	}

	const stdio = normalizeStdio.node(options);
	const defaultExecArgv = process.execArgv.filter(arg => !arg.startsWith('--inspect'));

	const {
		nodePath = process.execPath,
		nodeOptions = defaultExecArgv
	} = options;

	return execa(
		nodePath,
		[
			...nodeOptions,
			scriptPath,
			...(Array.isArray(args) ? args : [])
		],
		{
			...options,
			stdin: undefined,
			stdout: undefined,
			stderr: undefined,
			stdio,
			shell: false
		}
	);
};

var execaExports = execa$2.exports;
var execa$1 = /*@__PURE__*/getDefaultExportFromCjs(execaExports);

function ansiRegex({onlyFirst = false} = {}) {
	// Valid string terminator sequences are BEL, ESC\, and 0x9c
	const ST = '(?:\\u0007|\\u001B\\u005C|\\u009C)';
	const pattern = [
		`[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?${ST})`,
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
	].join('|');

	return new RegExp(pattern, onlyFirst ? undefined : 'g');
}

const regex = ansiRegex();

function stripAnsi(string) {
	if (typeof string !== 'string') {
		throw new TypeError(`Expected a \`string\`, got \`${typeof string}\``);
	}

	// Even though the regex is global, we don't need to reset the `.lastIndex`
	// because unlike `.exec()` and `.test()`, `.replace()` does it automatically
	// and doing it manually has a performance penalty.
	return string.replace(regex, '');
}

const detectDefaultShell = () => {
	const {env} = process$2;

	if (process$2.platform === 'win32') {
		return env.COMSPEC || 'cmd.exe';
	}

	try {
		const {shell} = node_os.userInfo();
		if (shell) {
			return shell;
		}
	} catch {}

	if (process$2.platform === 'darwin') {
		return env.SHELL || '/bin/zsh';
	}

	return env.SHELL || '/bin/sh';
};

// Stores default shell when imported.
const defaultShell = detectDefaultShell();

const args = [
	'-ilc',
	'echo -n "_SHELL_ENV_DELIMITER_"; env; echo -n "_SHELL_ENV_DELIMITER_"; exit',
];

const env = {
	// Disables Oh My Zsh auto-update thing that can block the process.
	DISABLE_AUTO_UPDATE: 'true',
};

const parseEnv = env => {
	env = env.split('_SHELL_ENV_DELIMITER_')[1];
	const returnValue = {};

	for (const line of stripAnsi(env).split('\n').filter(line => Boolean(line))) {
		const [key, ...values] = line.split('=');
		returnValue[key] = values.join('=');
	}

	return returnValue;
};

function shellEnvSync(shell) {
	if (process$2.platform === 'win32') {
		return process$2.env;
	}

	try {
		const {stdout} = execa$1.sync(shell || defaultShell, args, {env});
		return parseEnv(stdout);
	} catch (error) {
		if (shell) {
			throw error;
		} else {
			return process$2.env;
		}
	}
}

function shellPathSync() {
	const {PATH} = shellEnvSync();
	return PATH;
}

function fixPath() {
	if (process$2.platform === 'win32') {
		return;
	}

	process$2.env.PATH = shellPathSync() || [
		'./node_modules/.bin',
		'/.nodebrew/current/bin',
		'/usr/local/bin',
		process$2.env.PATH,
	].join(':');
}

const IMAGE_EXT_LIST = [
    ".png",
    ".jpg",
    ".jpeg",
    ".bmp",
    ".gif",
    ".svg",
    ".tiff",
    ".webp",
    ".avif",
];
const VIDEO_EXT_LIST = [".mp4", ".mov", ".webm", ".mkv", ".avi"];
const AUDIO_EXT_LIST = [".mp3", ".wav", ".flac", ".aac", ".ogg"];
const MEDIA_EXT_LIST = [
    ...VIDEO_EXT_LIST,
    ...AUDIO_EXT_LIST,
];
function isAnImage(ext) {
    return IMAGE_EXT_LIST.includes(ext.toLowerCase());
}
function isAssetTypeAnAsset(path) {
    const ext = pathBrowserify.extname(path).toLowerCase();
    return isAnImage(ext) || MEDIA_EXT_LIST.includes(ext);
}
function isHtmlFile(name) {
    const ext = pathBrowserify.extname(name).toLowerCase();
    return ext === ".html" || ext === ".htm";
}
function wrapHtmlPreviewCode(source) {
    const runs = source.match(/`+/g);
    const longestRun = runs ? Math.max(...runs.map(run => run.length)) : 0;
    const fenceLength = longestRun >= 3 ? longestRun + 1 : 5;
    const fence = "`".repeat(fenceLength);
    return `${fence}html-preview\n${source}\n${fence}\n`;
}
function wrapHtmlPreviewPath(path) {
    return `\`\`\`html-preview\npath:${path}\n\`\`\`\n`;
}
function getEmbedMarkdown(fileName, url, imageName = fileName) {
    const ext = pathBrowserify.extname(fileName).toLowerCase();
    if (VIDEO_EXT_LIST.includes(ext)) {
        return `<video src="${url}" controls width="300"></video>`;
    }
    if (AUDIO_EXT_LIST.includes(ext)) {
        return `<audio src="${url}" controls></audio>`;
    }
    return `![${imageName}](${url})`;
}
function getOS() {
    const { appVersion } = navigator;
    if (appVersion.indexOf("Win") !== -1) {
        return "Windows";
    }
    else if (appVersion.indexOf("Mac") !== -1) {
        return "MacOS";
    }
    else if (appVersion.indexOf("X11") !== -1) {
        return "Linux";
    }
    else {
        return "Unknown OS";
    }
}
async function streamToString(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }
    // @ts-ignore
    return Buffer.concat(chunks).toString("utf-8");
}
function getUrlAsset(url) {
    return (url = url.substr(1 + url.lastIndexOf("/")).split("?")[0]).split("#")[0];
}
function getLastImage(list) {
    const reversedList = list.reverse();
    let lastImage;
    reversedList.forEach(item => {
        if (item && item.startsWith("http")) {
            lastImage = item;
            return item;
        }
    });
    return lastImage;
}
function arrayToObject(arr, key) {
    const obj = {};
    arr.forEach(element => {
        obj[element[key]] = element;
    });
    return obj;
}
function bufferToArrayBuffer(buffer) {
    const arrayBuffer = new ArrayBuffer(buffer.length);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < buffer.length; i++) {
        view[i] = buffer[i];
    }
    return arrayBuffer;
}
function uuid() {
    return Math.random().toString(36).slice(2);
}

function renderHtmlPreview(container, source, app) {
    container.addClass("html-preview-container");
    const toolbar = container.createEl("div", { cls: "html-preview-toolbar" });
    const codeButton = toolbar.createEl("button", {
        cls: "html-preview-tool-button",
    });
    obsidian.setIcon(codeButton, "code");
    codeButton.setAttribute("aria-label", "View source");
    const maximizeButton = toolbar.createEl("button", {
        cls: "html-preview-tool-button",
    });
    obsidian.setIcon(maximizeButton, "maximize");
    maximizeButton.setAttribute("aria-label", "Open fullscreen preview");
    const deleteButton = toolbar.createEl("button", {
        cls: "html-preview-tool-button",
    });
    obsidian.setIcon(deleteButton, "trash-2");
    deleteButton.setAttribute("aria-label", "Delete HTML preview");
    const frameWrapper = container.createEl("div", {
        cls: "html-preview-frame-wrapper",
    });
    const iframe = frameWrapper.createEl("iframe", {
        cls: "html-preview-iframe",
    });
    iframe.hide();
    const errorEl = frameWrapper.createEl("div", { cls: "html-preview-error" });
    errorEl.hide();
    const resizeHandle = container.createEl("div", {
        cls: "html-preview-resize-handle",
        attr: { "aria-label": "Resize preview" },
    });
    const trimmedSource = source.trim();
    let loadHtml;
    if (trimmedSource.startsWith("path:")) {
        const filePath = trimmedSource.slice(5).trim();
        loadHtml = async () => {
            try {
                return await app.vault.adapter.read(filePath);
            }
            catch (error) {
                throw new Error(`HTML 文件未找到：${filePath}`);
            }
        };
    }
    else {
        loadHtml = async () => trimmedSource;
    }
    loadHtml()
        .then(html => {
        iframe.srcdoc = html;
        iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
        iframe.show();
        codeButton.addEventListener("click", async () => {
            try {
                const currentHtml = await loadHtml();
                openHtmlSourceModal(app, currentHtml);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                new obsidian.Notice(message);
            }
        });
        maximizeButton.addEventListener("click", async () => {
            try {
                const currentHtml = await loadHtml();
                openHtmlPreviewModal(app, currentHtml);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                new obsidian.Notice(message);
            }
        });
        deleteButton.addEventListener("click", () => {
            showDeleteConfirmPopover(deleteButton, async () => {
                await deleteHtmlPreviewBlock(app, source);
            });
        });
    })
        .catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        errorEl.setText(message);
        errorEl.show();
    });
    setupResizeHandle(resizeHandle, container);
}
function scanAndRenderHtmlPreviews(root, app) {
    const codeBlocks = root.querySelectorAll("pre > code.language-html-preview");
    codeBlocks.forEach(code => {
        const pre = code.parentElement;
        const source = code.textContent || "";
        const container = document.createElement("div");
        renderHtmlPreview(container, source, app);
        pre.replaceWith(container);
    });
}
function setupResizeHandle(handle, container) {
    const MIN_HEIGHT = 150;
    function startResize(clientY) {
        const rect = container.getBoundingClientRect();
        const startHeight = rect.height;
        let rafId = null;
        let pendingY = null;
        const overlay = document.createElement("div");
        overlay.addClass("html-preview-resize-overlay");
        container.appendChild(overlay);
        document.body.style.cursor = "ns-resize";
        container.addClass("html-preview-resizing");
        function updateHeight(moveY) {
            const dy = moveY - clientY;
            const newHeight = Math.max(MIN_HEIGHT, startHeight + dy);
            container.style.height = `${newHeight}px`;
        }
        function onPointerMove(moveEvent) {
            pendingY = moveEvent.clientY;
            if (rafId === null) {
                rafId = window.requestAnimationFrame(() => {
                    if (pendingY !== null) {
                        updateHeight(pendingY);
                        pendingY = null;
                    }
                    rafId = null;
                });
            }
        }
        function onPointerUp() {
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
                rafId = null;
            }
            if (pendingY !== null) {
                updateHeight(pendingY);
                pendingY = null;
            }
            overlay.remove();
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
            document.body.style.cursor = "";
            container.removeClass("html-preview-resizing");
        }
        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);
    }
    handle.addEventListener("pointerdown", event => {
        event.preventDefault();
        startResize(event.clientY);
    });
}
function showDeleteConfirmPopover(button, onConfirm) {
    document.querySelector(".html-preview-delete-popover")?.remove();
    const popover = document.createElement("div");
    popover.addClass("html-preview-delete-popover");
    popover.createEl("div", {
        cls: "html-preview-delete-message",
        text: "删除此 HTML 预览？",
    });
    const buttons = popover.createEl("div", {
        cls: "html-preview-delete-buttons",
    });
    const cancelButton = buttons.createEl("button", {
        cls: "html-preview-delete-cancel",
        text: "取消",
    });
    const confirmButton = buttons.createEl("button", {
        cls: "html-preview-delete-confirm mod-warning",
        text: "确认删除",
    });
    document.body.appendChild(popover);
    const rect = button.getBoundingClientRect();
    popover.style.left = `${rect.left}px`;
    popover.style.top = `${rect.bottom + 4}px`;
    const closePopover = () => popover.remove();
    function outsideClickHandler(event) {
        const target = event.target;
        if (!popover.contains(target) && !button.contains(target)) {
            closePopover();
        }
        else {
            document.addEventListener("click", outsideClickHandler, { once: true });
        }
    }
    window.setTimeout(() => {
        document.addEventListener("click", outsideClickHandler, { once: true });
    }, 0);
    cancelButton.addEventListener("click", closePopover);
    confirmButton.addEventListener("click", async () => {
        closePopover();
        await onConfirm();
    });
}
async function deleteHtmlPreviewBlock(app, source) {
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) {
        new obsidian.Notice("未找到当前文件");
        return;
    }
    try {
        const content = await app.vault.read(activeFile);
        const trimmedSource = source.trim();
        const escapedSource = escapeRegExp(trimmedSource);
        const codeBlockRegex = new RegExp("`{3,}\\s*html-preview\\s*\\n" + escapedSource + "\\n`{3,}\\s*\\n?", "g");
        const newContent = content.replace(codeBlockRegex, "");
        if (newContent === content) {
            new obsidian.Notice("未找到要删除的 HTML 预览代码块");
            return;
        }
        let sourceFileDeleted = false;
        if (trimmedSource.startsWith("path:")) {
            const filePath = trimmedSource.slice(5).trim();
            let referenceCount = 0;
            for (const mdFile of app.vault.getMarkdownFiles()) {
                const mdContent = await app.vault.read(mdFile);
                const matches = mdContent.match(new RegExp("path:" + escapeRegExp(filePath), "g"));
                if (matches) {
                    referenceCount += matches.length;
                }
            }
            if (referenceCount <= 1) {
                try {
                    await app.vault.adapter.remove(filePath);
                    sourceFileDeleted = true;
                }
                catch (error) {
                    console.error("Failed to remove HTML source file:", error);
                }
            }
        }
        await app.vault.modify(activeFile, newContent);
        if (sourceFileDeleted) {
            new obsidian.Notice("已删除 HTML 预览");
        }
        else if (trimmedSource.startsWith("path:")) {
            new obsidian.Notice("已删除 HTML 预览（源文件保留，仍有其他引用）");
        }
        else {
            new obsidian.Notice("已删除 HTML 预览");
        }
    }
    catch (error) {
        console.error("Failed to delete HTML preview:", error);
        new obsidian.Notice("删除 HTML 预览失败");
    }
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function openHtmlSourceModal(app, source) {
    class HtmlSourceModal extends obsidian.Modal {
        source;
        constructor(app, source) {
            super(app);
            this.source = source;
        }
        onOpen() {
            this.modalEl.addClass("html-preview-modal");
            const { contentEl } = this;
            contentEl.empty();
            const pre = contentEl.createEl("pre", { cls: "html-preview-source" });
            const code = pre.createEl("code");
            code.setText(this.source);
        }
        onClose() {
            const { contentEl } = this;
            contentEl.empty();
        }
    }
    new HtmlSourceModal(app, source).open();
}
function openHtmlPreviewModal(app, source) {
    class HtmlPreviewModal extends obsidian.Modal {
        source;
        constructor(app, source) {
            super(app);
            this.source = source;
        }
        onOpen() {
            this.modalEl.addClass("html-preview-modal");
            const { contentEl } = this;
            contentEl.empty();
            const iframe = contentEl.createEl("iframe", {
                cls: "html-preview-modal-iframe",
            });
            iframe.srcdoc = this.source;
            iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
        }
        onClose() {
            const { contentEl } = this;
            contentEl.empty();
        }
    }
    new HtmlPreviewModal(app, source).open();
}

class HtmlPreviewWidget extends view.WidgetType {
    source;
    app;
    constructor(source, app) {
        super();
        this.source = source;
        this.app = app;
    }
    toDOM(view) {
        const div = document.createElement("div");
        renderHtmlPreview(div, this.source, this.app);
        return div;
    }
    eq(other) {
        return (other instanceof HtmlPreviewWidget &&
            other.source === this.source &&
            other.app === this.app);
    }
    get estimatedHeight() {
        return 500;
    }
    ignoreEvent(event) {
        return false;
    }
}
function htmlPreviewExtension(app) {
    return state.StateField.define({
        create(state) {
            return buildDecorations(state, app);
        },
        update(value, tr) {
            if (tr.docChanged) {
                return buildDecorations(tr.state, app);
            }
            return value;
        },
        provide: f => view.EditorView.decorations.from(f),
    });
}
function buildDecorations(state$1, app) {
    const builder = new state.RangeSetBuilder();
    const tree = language.syntaxTree(state$1);
    tree.iterate({
        enter: node => {
            if (node.type.name !== "FencedCode") {
                return;
            }
            let language = "";
            let source = "";
            const cursor = node.node.cursor();
            if (cursor.firstChild()) {
                do {
                    if (cursor.type.name === "CodeInfo") {
                        language = state$1.doc.sliceString(cursor.from, cursor.to);
                    }
                    else if (cursor.type.name === "CodeText") {
                        source = state$1.doc.sliceString(cursor.from, cursor.to);
                    }
                } while (cursor.nextSibling());
            }
            if (language === "html-preview") {
                builder.add(node.from, node.to, view.Decoration.replace({
                    widget: new HtmlPreviewWidget(source, app),
                    block: true,
                }));
            }
        },
    });
    return builder.finish();
}

// Primitive types
function dv(array) {
    return new DataView(array.buffer, array.byteOffset);
}
/**
 * 8-bit unsigned integer
 */
const UINT8 = {
    len: 1,
    get(array, offset) {
        return dv(array).getUint8(offset);
    },
    put(array, offset, value) {
        dv(array).setUint8(offset, value);
        return offset + 1;
    }
};
/**
 * 16-bit unsigned integer, Little Endian byte order
 */
const UINT16_LE = {
    len: 2,
    get(array, offset) {
        return dv(array).getUint16(offset, true);
    },
    put(array, offset, value) {
        dv(array).setUint16(offset, value, true);
        return offset + 2;
    }
};
/**
 * 16-bit unsigned integer, Big Endian byte order
 */
const UINT16_BE = {
    len: 2,
    get(array, offset) {
        return dv(array).getUint16(offset);
    },
    put(array, offset, value) {
        dv(array).setUint16(offset, value);
        return offset + 2;
    }
};
/**
 * 32-bit unsigned integer, Little Endian byte order
 */
const UINT32_LE = {
    len: 4,
    get(array, offset) {
        return dv(array).getUint32(offset, true);
    },
    put(array, offset, value) {
        dv(array).setUint32(offset, value, true);
        return offset + 4;
    }
};
/**
 * 32-bit unsigned integer, Big Endian byte order
 */
const UINT32_BE = {
    len: 4,
    get(array, offset) {
        return dv(array).getUint32(offset);
    },
    put(array, offset, value) {
        dv(array).setUint32(offset, value);
        return offset + 4;
    }
};
/**
 * 32-bit signed integer, Big Endian byte order
 */
const INT32_BE = {
    len: 4,
    get(array, offset) {
        return dv(array).getInt32(offset);
    },
    put(array, offset, value) {
        dv(array).setInt32(offset, value);
        return offset + 4;
    }
};
/**
 * 64-bit unsigned integer, Little Endian byte order
 */
const UINT64_LE = {
    len: 8,
    get(array, offset) {
        return dv(array).getBigUint64(offset, true);
    },
    put(array, offset, value) {
        dv(array).setBigUint64(offset, value, true);
        return offset + 8;
    }
};
/**
 * Consume a fixed number of bytes from the stream and return a string with a specified encoding.
 */
class StringType {
    constructor(len, encoding) {
        this.len = len;
        this.encoding = encoding;
    }
    get(uint8Array, offset) {
        return node_buffer.Buffer.from(uint8Array).toString(this.encoding, offset, offset + this.len);
    }
}

const defaultMessages = 'End-Of-Stream';
/**
 * Thrown on read operation of the end of file or stream has been reached
 */
class EndOfStreamError extends Error {
    constructor() {
        super(defaultMessages);
    }
}

class Deferred {
    constructor() {
        this.resolve = () => null;
        this.reject = () => null;
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });
    }
}

class AbstractStreamReader {
    constructor() {
        /**
         * Maximum request length on read-stream operation
         */
        this.maxStreamReadSize = 1 * 1024 * 1024;
        this.endOfStream = false;
        /**
         * Store peeked data
         * @type {Array}
         */
        this.peekQueue = [];
    }
    async peek(uint8Array, offset, length) {
        const bytesRead = await this.read(uint8Array, offset, length);
        this.peekQueue.push(uint8Array.subarray(offset, offset + bytesRead)); // Put read data back to peek buffer
        return bytesRead;
    }
    async read(buffer, offset, length) {
        if (length === 0) {
            return 0;
        }
        let bytesRead = this.readFromPeekBuffer(buffer, offset, length);
        bytesRead += await this.readRemainderFromStream(buffer, offset + bytesRead, length - bytesRead);
        if (bytesRead === 0) {
            throw new EndOfStreamError();
        }
        return bytesRead;
    }
    /**
     * Read chunk from stream
     * @param buffer - Target Uint8Array (or Buffer) to store data read from stream in
     * @param offset - Offset target
     * @param length - Number of bytes to read
     * @returns Number of bytes read
     */
    readFromPeekBuffer(buffer, offset, length) {
        let remaining = length;
        let bytesRead = 0;
        // consume peeked data first
        while (this.peekQueue.length > 0 && remaining > 0) {
            const peekData = this.peekQueue.pop(); // Front of queue
            if (!peekData)
                throw new Error('peekData should be defined');
            const lenCopy = Math.min(peekData.length, remaining);
            buffer.set(peekData.subarray(0, lenCopy), offset + bytesRead);
            bytesRead += lenCopy;
            remaining -= lenCopy;
            if (lenCopy < peekData.length) {
                // remainder back to queue
                this.peekQueue.push(peekData.subarray(lenCopy));
            }
        }
        return bytesRead;
    }
    async readRemainderFromStream(buffer, offset, initialRemaining) {
        let remaining = initialRemaining;
        let bytesRead = 0;
        // Continue reading from stream if required
        while (remaining > 0 && !this.endOfStream) {
            const reqLen = Math.min(remaining, this.maxStreamReadSize);
            const chunkLen = await this.readFromStream(buffer, offset + bytesRead, reqLen);
            if (chunkLen === 0)
                break;
            bytesRead += chunkLen;
            remaining -= chunkLen;
        }
        return bytesRead;
    }
}

/**
 * Node.js Readable Stream Reader
 * Ref: https://nodejs.org/api/stream.html#readable-streams
 */
class StreamReader extends AbstractStreamReader {
    constructor(s) {
        super();
        this.s = s;
        /**
         * Deferred used for postponed read request (as not data is yet available to read)
         */
        this.deferred = null;
        if (!s.read || !s.once) {
            throw new Error('Expected an instance of stream.Readable');
        }
        this.s.once('end', () => this.reject(new EndOfStreamError()));
        this.s.once('error', err => this.reject(err));
        this.s.once('close', () => this.reject(new Error('Stream closed')));
    }
    /**
     * Read chunk from stream
     * @param buffer Target Uint8Array (or Buffer) to store data read from stream in
     * @param offset Offset target
     * @param length Number of bytes to read
     * @returns Number of bytes read
     */
    async readFromStream(buffer, offset, length) {
        if (this.endOfStream) {
            return 0;
        }
        const readBuffer = this.s.read(length);
        if (readBuffer) {
            buffer.set(readBuffer, offset);
            return readBuffer.length;
        }
        const request = {
            buffer,
            offset,
            length,
            deferred: new Deferred()
        };
        this.deferred = request.deferred;
        this.s.once('readable', () => {
            this.readDeferred(request);
        });
        return request.deferred.promise;
    }
    /**
     * Process deferred read request
     * @param request Deferred read request
     */
    readDeferred(request) {
        const readBuffer = this.s.read(request.length);
        if (readBuffer) {
            request.buffer.set(readBuffer, request.offset);
            request.deferred.resolve(readBuffer.length);
            this.deferred = null;
        }
        else {
            this.s.once('readable', () => {
                this.readDeferred(request);
            });
        }
    }
    reject(err) {
        this.endOfStream = true;
        if (this.deferred) {
            this.deferred.reject(err);
            this.deferred = null;
        }
    }
    async abort() {
        this.s.destroy();
    }
}

/**
 * Core tokenizer
 */
class AbstractTokenizer {
    constructor(fileInfo) {
        /**
         * Tokenizer-stream position
         */
        this.position = 0;
        this.numBuffer = new Uint8Array(8);
        this.fileInfo = fileInfo ? fileInfo : {};
    }
    /**
     * Read a token from the tokenizer-stream
     * @param token - The token to read
     * @param position - If provided, the desired position in the tokenizer-stream
     * @returns Promise with token data
     */
    async readToken(token, position = this.position) {
        const uint8Array = new Uint8Array(token.len);
        const len = await this.readBuffer(uint8Array, { position });
        if (len < token.len)
            throw new EndOfStreamError();
        return token.get(uint8Array, 0);
    }
    /**
     * Peek a token from the tokenizer-stream.
     * @param token - Token to peek from the tokenizer-stream.
     * @param position - Offset where to begin reading within the file. If position is null, data will be read from the current file position.
     * @returns Promise with token data
     */
    async peekToken(token, position = this.position) {
        const uint8Array = new Uint8Array(token.len);
        const len = await this.peekBuffer(uint8Array, { position });
        if (len < token.len)
            throw new EndOfStreamError();
        return token.get(uint8Array, 0);
    }
    /**
     * Read a numeric token from the stream
     * @param token - Numeric token
     * @returns Promise with number
     */
    async readNumber(token) {
        const len = await this.readBuffer(this.numBuffer, { length: token.len });
        if (len < token.len)
            throw new EndOfStreamError();
        return token.get(this.numBuffer, 0);
    }
    /**
     * Read a numeric token from the stream
     * @param token - Numeric token
     * @returns Promise with number
     */
    async peekNumber(token) {
        const len = await this.peekBuffer(this.numBuffer, { length: token.len });
        if (len < token.len)
            throw new EndOfStreamError();
        return token.get(this.numBuffer, 0);
    }
    /**
     * Ignore number of bytes, advances the pointer in under tokenizer-stream.
     * @param length - Number of bytes to ignore
     * @return resolves the number of bytes ignored, equals length if this available, otherwise the number of bytes available
     */
    async ignore(length) {
        if (this.fileInfo.size !== undefined) {
            const bytesLeft = this.fileInfo.size - this.position;
            if (length > bytesLeft) {
                this.position += bytesLeft;
                return bytesLeft;
            }
        }
        this.position += length;
        return length;
    }
    async close() {
        // empty
    }
    normalizeOptions(uint8Array, options) {
        if (options && options.position !== undefined && options.position < this.position) {
            throw new Error('`options.position` must be equal or greater than `tokenizer.position`');
        }
        if (options) {
            return {
                mayBeLess: options.mayBeLess === true,
                offset: options.offset ? options.offset : 0,
                length: options.length ? options.length : (uint8Array.length - (options.offset ? options.offset : 0)),
                position: options.position ? options.position : this.position
            };
        }
        return {
            mayBeLess: false,
            offset: 0,
            length: uint8Array.length,
            position: this.position
        };
    }
}

const maxBufferSize = 256000;
class ReadStreamTokenizer extends AbstractTokenizer {
    constructor(streamReader, fileInfo) {
        super(fileInfo);
        this.streamReader = streamReader;
    }
    /**
     * Get file information, an HTTP-client may implement this doing a HEAD request
     * @return Promise with file information
     */
    async getFileInfo() {
        return this.fileInfo;
    }
    /**
     * Read buffer from tokenizer
     * @param uint8Array - Target Uint8Array to fill with data read from the tokenizer-stream
     * @param options - Read behaviour options
     * @returns Promise with number of bytes read
     */
    async readBuffer(uint8Array, options) {
        const normOptions = this.normalizeOptions(uint8Array, options);
        const skipBytes = normOptions.position - this.position;
        if (skipBytes > 0) {
            await this.ignore(skipBytes);
            return this.readBuffer(uint8Array, options);
        }
        else if (skipBytes < 0) {
            throw new Error('`options.position` must be equal or greater than `tokenizer.position`');
        }
        if (normOptions.length === 0) {
            return 0;
        }
        const bytesRead = await this.streamReader.read(uint8Array, normOptions.offset, normOptions.length);
        this.position += bytesRead;
        if ((!options || !options.mayBeLess) && bytesRead < normOptions.length) {
            throw new EndOfStreamError();
        }
        return bytesRead;
    }
    /**
     * Peek (read ahead) buffer from tokenizer
     * @param uint8Array - Uint8Array (or Buffer) to write data to
     * @param options - Read behaviour options
     * @returns Promise with number of bytes peeked
     */
    async peekBuffer(uint8Array, options) {
        const normOptions = this.normalizeOptions(uint8Array, options);
        let bytesRead = 0;
        if (normOptions.position) {
            const skipBytes = normOptions.position - this.position;
            if (skipBytes > 0) {
                const skipBuffer = new Uint8Array(normOptions.length + skipBytes);
                bytesRead = await this.peekBuffer(skipBuffer, { mayBeLess: normOptions.mayBeLess });
                uint8Array.set(skipBuffer.subarray(skipBytes), normOptions.offset);
                return bytesRead - skipBytes;
            }
            else if (skipBytes < 0) {
                throw new Error('Cannot peek from a negative offset in a stream');
            }
        }
        if (normOptions.length > 0) {
            try {
                bytesRead = await this.streamReader.peek(uint8Array, normOptions.offset, normOptions.length);
            }
            catch (err) {
                if (options && options.mayBeLess && err instanceof EndOfStreamError) {
                    return 0;
                }
                throw err;
            }
            if ((!normOptions.mayBeLess) && bytesRead < normOptions.length) {
                throw new EndOfStreamError();
            }
        }
        return bytesRead;
    }
    async ignore(length) {
        // debug(`ignore ${this.position}...${this.position + length - 1}`);
        const bufSize = Math.min(maxBufferSize, length);
        const buf = new Uint8Array(bufSize);
        let totBytesRead = 0;
        while (totBytesRead < length) {
            const remaining = length - totBytesRead;
            const bytesRead = await this.readBuffer(buf, { length: Math.min(bufSize, remaining) });
            if (bytesRead < 0) {
                return bytesRead;
            }
            totBytesRead += bytesRead;
        }
        return totBytesRead;
    }
}

class BufferTokenizer extends AbstractTokenizer {
    /**
     * Construct BufferTokenizer
     * @param uint8Array - Uint8Array to tokenize
     * @param fileInfo - Pass additional file information to the tokenizer
     */
    constructor(uint8Array, fileInfo) {
        super(fileInfo);
        this.uint8Array = uint8Array;
        this.fileInfo.size = this.fileInfo.size ? this.fileInfo.size : uint8Array.length;
    }
    /**
     * Read buffer from tokenizer
     * @param uint8Array - Uint8Array to tokenize
     * @param options - Read behaviour options
     * @returns {Promise<number>}
     */
    async readBuffer(uint8Array, options) {
        if (options && options.position) {
            if (options.position < this.position) {
                throw new Error('`options.position` must be equal or greater than `tokenizer.position`');
            }
            this.position = options.position;
        }
        const bytesRead = await this.peekBuffer(uint8Array, options);
        this.position += bytesRead;
        return bytesRead;
    }
    /**
     * Peek (read ahead) buffer from tokenizer
     * @param uint8Array
     * @param options - Read behaviour options
     * @returns {Promise<number>}
     */
    async peekBuffer(uint8Array, options) {
        const normOptions = this.normalizeOptions(uint8Array, options);
        const bytes2read = Math.min(this.uint8Array.length - normOptions.position, normOptions.length);
        if ((!normOptions.mayBeLess) && bytes2read < normOptions.length) {
            throw new EndOfStreamError();
        }
        else {
            uint8Array.set(this.uint8Array.subarray(normOptions.position, normOptions.position + bytes2read), normOptions.offset);
            return bytes2read;
        }
    }
    async close() {
        // empty
    }
}

/**
 * Construct ReadStreamTokenizer from given Stream.
 * Will set fileSize, if provided given Stream has set the .path property/
 * @param stream - Read from Node.js Stream.Readable
 * @param fileInfo - Pass the file information, like size and MIME-type of the corresponding stream.
 * @returns ReadStreamTokenizer
 */
function fromStream(stream, fileInfo) {
    fileInfo = fileInfo ? fileInfo : {};
    return new ReadStreamTokenizer(new StreamReader(stream), fileInfo);
}
/**
 * Construct ReadStreamTokenizer from given Buffer.
 * @param uint8Array - Uint8Array to tokenize
 * @param fileInfo - Pass additional file information to the tokenizer
 * @returns BufferTokenizer
 */
function fromBuffer(uint8Array, fileInfo) {
    return new BufferTokenizer(uint8Array, fileInfo);
}

function stringToBytes(string) {
	return [...string].map(character => character.charCodeAt(0)); // eslint-disable-line unicorn/prefer-code-point
}

/**
Checks whether the TAR checksum is valid.

@param {Buffer} buffer - The TAR header `[offset ... offset + 512]`.
@param {number} offset - TAR header offset.
@returns {boolean} `true` if the TAR checksum is valid, otherwise `false`.
*/
function tarHeaderChecksumMatches(buffer, offset = 0) {
	const readSum = Number.parseInt(buffer.toString('utf8', 148, 154).replace(/\0.*$/, '').trim(), 8); // Read sum in header
	if (Number.isNaN(readSum)) {
		return false;
	}

	let sum = 8 * 0x20; // Initialize signed bit sum

	for (let index = offset; index < offset + 148; index++) {
		sum += buffer[index];
	}

	for (let index = offset + 156; index < offset + 512; index++) {
		sum += buffer[index];
	}

	return readSum === sum;
}

/**
ID3 UINT32 sync-safe tokenizer token.
28 bits (representing up to 256MB) integer, the msb is 0 to avoid "false syncsignals".
*/
const uint32SyncSafeToken = {
	get: (buffer, offset) => (buffer[offset + 3] & 0x7F) | ((buffer[offset + 2]) << 7) | ((buffer[offset + 1]) << 14) | ((buffer[offset]) << 21),
	len: 4,
};

const extensions = [
	'jpg',
	'png',
	'apng',
	'gif',
	'webp',
	'flif',
	'xcf',
	'cr2',
	'cr3',
	'orf',
	'arw',
	'dng',
	'nef',
	'rw2',
	'raf',
	'tif',
	'bmp',
	'icns',
	'jxr',
	'psd',
	'indd',
	'zip',
	'tar',
	'rar',
	'gz',
	'bz2',
	'7z',
	'dmg',
	'mp4',
	'mid',
	'mkv',
	'webm',
	'mov',
	'avi',
	'mpg',
	'mp2',
	'mp3',
	'm4a',
	'oga',
	'ogg',
	'ogv',
	'opus',
	'flac',
	'wav',
	'spx',
	'amr',
	'pdf',
	'epub',
	'elf',
	'macho',
	'exe',
	'swf',
	'rtf',
	'wasm',
	'woff',
	'woff2',
	'eot',
	'ttf',
	'otf',
	'ico',
	'flv',
	'ps',
	'xz',
	'sqlite',
	'nes',
	'crx',
	'xpi',
	'cab',
	'deb',
	'ar',
	'rpm',
	'Z',
	'lz',
	'cfb',
	'mxf',
	'mts',
	'blend',
	'bpg',
	'docx',
	'pptx',
	'xlsx',
	'3gp',
	'3g2',
	'j2c',
	'jp2',
	'jpm',
	'jpx',
	'mj2',
	'aif',
	'qcp',
	'odt',
	'ods',
	'odp',
	'xml',
	'mobi',
	'heic',
	'cur',
	'ktx',
	'ape',
	'wv',
	'dcm',
	'ics',
	'glb',
	'pcap',
	'dsf',
	'lnk',
	'alias',
	'voc',
	'ac3',
	'm4v',
	'm4p',
	'm4b',
	'f4v',
	'f4p',
	'f4b',
	'f4a',
	'mie',
	'asf',
	'ogm',
	'ogx',
	'mpc',
	'arrow',
	'shp',
	'aac',
	'mp1',
	'it',
	's3m',
	'xm',
	'ai',
	'skp',
	'avif',
	'eps',
	'lzh',
	'pgp',
	'asar',
	'stl',
	'chm',
	'3mf',
	'zst',
	'jxl',
	'vcf',
	'jls',
	'pst',
	'dwg',
	'parquet',
	'class',
	'arj',
	'cpio',
	'ace',
	'avro',
	'icc',
	'fbx',
];

const mimeTypes = [
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/flif',
	'image/x-xcf',
	'image/x-canon-cr2',
	'image/x-canon-cr3',
	'image/tiff',
	'image/bmp',
	'image/vnd.ms-photo',
	'image/vnd.adobe.photoshop',
	'application/x-indesign',
	'application/epub+zip',
	'application/x-xpinstall',
	'application/vnd.oasis.opendocument.text',
	'application/vnd.oasis.opendocument.spreadsheet',
	'application/vnd.oasis.opendocument.presentation',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/zip',
	'application/x-tar',
	'application/x-rar-compressed',
	'application/gzip',
	'application/x-bzip2',
	'application/x-7z-compressed',
	'application/x-apple-diskimage',
	'application/x-apache-arrow',
	'video/mp4',
	'audio/midi',
	'video/x-matroska',
	'video/webm',
	'video/quicktime',
	'video/vnd.avi',
	'audio/vnd.wave',
	'audio/qcelp',
	'audio/x-ms-asf',
	'video/x-ms-asf',
	'application/vnd.ms-asf',
	'video/mpeg',
	'video/3gpp',
	'audio/mpeg',
	'audio/mp4', // RFC 4337
	'audio/opus',
	'video/ogg',
	'audio/ogg',
	'application/ogg',
	'audio/x-flac',
	'audio/ape',
	'audio/wavpack',
	'audio/amr',
	'application/pdf',
	'application/x-elf',
	'application/x-mach-binary',
	'application/x-msdownload',
	'application/x-shockwave-flash',
	'application/rtf',
	'application/wasm',
	'font/woff',
	'font/woff2',
	'application/vnd.ms-fontobject',
	'font/ttf',
	'font/otf',
	'image/x-icon',
	'video/x-flv',
	'application/postscript',
	'application/eps',
	'application/x-xz',
	'application/x-sqlite3',
	'application/x-nintendo-nes-rom',
	'application/x-google-chrome-extension',
	'application/vnd.ms-cab-compressed',
	'application/x-deb',
	'application/x-unix-archive',
	'application/x-rpm',
	'application/x-compress',
	'application/x-lzip',
	'application/x-cfb',
	'application/x-mie',
	'application/mxf',
	'video/mp2t',
	'application/x-blender',
	'image/bpg',
	'image/j2c',
	'image/jp2',
	'image/jpx',
	'image/jpm',
	'image/mj2',
	'audio/aiff',
	'application/xml',
	'application/x-mobipocket-ebook',
	'image/heif',
	'image/heif-sequence',
	'image/heic',
	'image/heic-sequence',
	'image/icns',
	'image/ktx',
	'application/dicom',
	'audio/x-musepack',
	'text/calendar',
	'text/vcard',
	'model/gltf-binary',
	'application/vnd.tcpdump.pcap',
	'audio/x-dsf', // Non-standard
	'application/x.ms.shortcut', // Invented by us
	'application/x.apple.alias', // Invented by us
	'audio/x-voc',
	'audio/vnd.dolby.dd-raw',
	'audio/x-m4a',
	'image/apng',
	'image/x-olympus-orf',
	'image/x-sony-arw',
	'image/x-adobe-dng',
	'image/x-nikon-nef',
	'image/x-panasonic-rw2',
	'image/x-fujifilm-raf',
	'video/x-m4v',
	'video/3gpp2',
	'application/x-esri-shape',
	'audio/aac',
	'audio/x-it',
	'audio/x-s3m',
	'audio/x-xm',
	'video/MP1S',
	'video/MP2P',
	'application/vnd.sketchup.skp',
	'image/avif',
	'application/x-lzh-compressed',
	'application/pgp-encrypted',
	'application/x-asar',
	'model/stl',
	'application/vnd.ms-htmlhelp',
	'model/3mf',
	'image/jxl',
	'application/zstd',
	'image/jls',
	'application/vnd.ms-outlook',
	'image/vnd.dwg',
	'application/x-parquet',
	'application/java-vm',
	'application/x-arj',
	'application/x-cpio',
	'application/x-ace-compressed',
	'application/avro',
	'application/vnd.iccprofile',
	'application/x.autodesk.fbx', // Invented by us
];

const minimumBytes = 4100; // A fair amount of file-types are detectable within this range.

async function fileTypeFromBuffer(input) {
	return new FileTypeParser().fromBuffer(input);
}

function _check(buffer, headers, options) {
	options = {
		offset: 0,
		...options,
	};

	for (const [index, header] of headers.entries()) {
		// If a bitmask is set
		if (options.mask) {
			// If header doesn't equal `buf` with bits masked off
			if (header !== (options.mask[index] & buffer[index + options.offset])) {
				return false;
			}
		} else if (header !== buffer[index + options.offset]) {
			return false;
		}
	}

	return true;
}

class FileTypeParser {
	constructor(options) {
		this.detectors = options?.customDetectors;

		this.fromTokenizer = this.fromTokenizer.bind(this);
		this.fromBuffer = this.fromBuffer.bind(this);
		this.parse = this.parse.bind(this);
	}

	async fromTokenizer(tokenizer) {
		const initialPosition = tokenizer.position;

		for (const detector of this.detectors || []) {
			const fileType = await detector(tokenizer);
			if (fileType) {
				return fileType;
			}

			if (initialPosition !== tokenizer.position) {
				return undefined; // Cannot proceed scanning of the tokenizer is at an arbitrary position
			}
		}

		return this.parse(tokenizer);
	}

	async fromBuffer(input) {
		if (!(input instanceof Uint8Array || input instanceof ArrayBuffer)) {
			throw new TypeError(`Expected the \`input\` argument to be of type \`Uint8Array\` or \`Buffer\` or \`ArrayBuffer\`, got \`${typeof input}\``);
		}

		const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);

		if (!(buffer?.length > 1)) {
			return;
		}

		return this.fromTokenizer(fromBuffer(buffer));
	}

	async fromBlob(blob) {
		const buffer = await blob.arrayBuffer();
		return this.fromBuffer(new Uint8Array(buffer));
	}

	async fromStream(stream) {
		const tokenizer = await fromStream(stream);
		try {
			return await this.fromTokenizer(tokenizer);
		} finally {
			await tokenizer.close();
		}
	}

	async toDetectionStream(readableStream, options = {}) {
		const {default: stream} = await import('node:stream');
		const {sampleSize = minimumBytes} = options;

		return new Promise((resolve, reject) => {
			readableStream.on('error', reject);

			readableStream.once('readable', () => {
				(async () => {
					try {
						// Set up output stream
						const pass = new stream.PassThrough();
						const outputStream = stream.pipeline ? stream.pipeline(readableStream, pass, () => {}) : readableStream.pipe(pass);

						// Read the input stream and detect the filetype
						const chunk = readableStream.read(sampleSize) ?? readableStream.read() ?? node_buffer.Buffer.alloc(0);
						try {
							pass.fileType = await this.fromBuffer(chunk);
						} catch (error) {
							if (error instanceof EndOfStreamError) {
								pass.fileType = undefined;
							} else {
								reject(error);
							}
						}

						resolve(outputStream);
					} catch (error) {
						reject(error);
					}
				})();
			});
		});
	}

	check(header, options) {
		return _check(this.buffer, header, options);
	}

	checkString(header, options) {
		return this.check(stringToBytes(header), options);
	}

	async parse(tokenizer) {
		this.buffer = node_buffer.Buffer.alloc(minimumBytes);

		// Keep reading until EOF if the file size is unknown.
		if (tokenizer.fileInfo.size === undefined) {
			tokenizer.fileInfo.size = Number.MAX_SAFE_INTEGER;
		}

		this.tokenizer = tokenizer;

		await tokenizer.peekBuffer(this.buffer, {length: 12, mayBeLess: true});

		// -- 2-byte signatures --

		if (this.check([0x42, 0x4D])) {
			return {
				ext: 'bmp',
				mime: 'image/bmp',
			};
		}

		if (this.check([0x0B, 0x77])) {
			return {
				ext: 'ac3',
				mime: 'audio/vnd.dolby.dd-raw',
			};
		}

		if (this.check([0x78, 0x01])) {
			return {
				ext: 'dmg',
				mime: 'application/x-apple-diskimage',
			};
		}

		if (this.check([0x4D, 0x5A])) {
			return {
				ext: 'exe',
				mime: 'application/x-msdownload',
			};
		}

		if (this.check([0x25, 0x21])) {
			await tokenizer.peekBuffer(this.buffer, {length: 24, mayBeLess: true});

			if (
				this.checkString('PS-Adobe-', {offset: 2})
				&& this.checkString(' EPSF-', {offset: 14})
			) {
				return {
					ext: 'eps',
					mime: 'application/eps',
				};
			}

			return {
				ext: 'ps',
				mime: 'application/postscript',
			};
		}

		if (
			this.check([0x1F, 0xA0])
			|| this.check([0x1F, 0x9D])
		) {
			return {
				ext: 'Z',
				mime: 'application/x-compress',
			};
		}

		if (this.check([0xC7, 0x71])) {
			return {
				ext: 'cpio',
				mime: 'application/x-cpio',
			};
		}

		if (this.check([0x60, 0xEA])) {
			return {
				ext: 'arj',
				mime: 'application/x-arj',
			};
		}

		// -- 3-byte signatures --

		if (this.check([0xEF, 0xBB, 0xBF])) { // UTF-8-BOM
			// Strip off UTF-8-BOM
			this.tokenizer.ignore(3);
			return this.parse(tokenizer);
		}

		if (this.check([0x47, 0x49, 0x46])) {
			return {
				ext: 'gif',
				mime: 'image/gif',
			};
		}

		if (this.check([0x49, 0x49, 0xBC])) {
			return {
				ext: 'jxr',
				mime: 'image/vnd.ms-photo',
			};
		}

		if (this.check([0x1F, 0x8B, 0x8])) {
			return {
				ext: 'gz',
				mime: 'application/gzip',
			};
		}

		if (this.check([0x42, 0x5A, 0x68])) {
			return {
				ext: 'bz2',
				mime: 'application/x-bzip2',
			};
		}

		if (this.checkString('ID3')) {
			await tokenizer.ignore(6); // Skip ID3 header until the header size
			const id3HeaderLength = await tokenizer.readToken(uint32SyncSafeToken);
			if (tokenizer.position + id3HeaderLength > tokenizer.fileInfo.size) {
				// Guess file type based on ID3 header for backward compatibility
				return {
					ext: 'mp3',
					mime: 'audio/mpeg',
				};
			}

			await tokenizer.ignore(id3HeaderLength);
			return this.fromTokenizer(tokenizer); // Skip ID3 header, recursion
		}

		// Musepack, SV7
		if (this.checkString('MP+')) {
			return {
				ext: 'mpc',
				mime: 'audio/x-musepack',
			};
		}

		if (
			(this.buffer[0] === 0x43 || this.buffer[0] === 0x46)
			&& this.check([0x57, 0x53], {offset: 1})
		) {
			return {
				ext: 'swf',
				mime: 'application/x-shockwave-flash',
			};
		}

		// -- 4-byte signatures --

		// Requires a sample size of 4 bytes
		if (this.check([0xFF, 0xD8, 0xFF])) {
			if (this.check([0xF7], {offset: 3})) { // JPG7/SOF55, indicating a ISO/IEC 14495 / JPEG-LS file
				return {
					ext: 'jls',
					mime: 'image/jls',
				};
			}

			return {
				ext: 'jpg',
				mime: 'image/jpeg',
			};
		}

		if (this.check([0x4F, 0x62, 0x6A, 0x01])) {
			return {
				ext: 'avro',
				mime: 'application/avro',
			};
		}

		if (this.checkString('FLIF')) {
			return {
				ext: 'flif',
				mime: 'image/flif',
			};
		}

		if (this.checkString('8BPS')) {
			return {
				ext: 'psd',
				mime: 'image/vnd.adobe.photoshop',
			};
		}

		if (this.checkString('WEBP', {offset: 8})) {
			return {
				ext: 'webp',
				mime: 'image/webp',
			};
		}

		// Musepack, SV8
		if (this.checkString('MPCK')) {
			return {
				ext: 'mpc',
				mime: 'audio/x-musepack',
			};
		}

		if (this.checkString('FORM')) {
			return {
				ext: 'aif',
				mime: 'audio/aiff',
			};
		}

		if (this.checkString('icns', {offset: 0})) {
			return {
				ext: 'icns',
				mime: 'image/icns',
			};
		}

		// Zip-based file formats
		// Need to be before the `zip` check
		if (this.check([0x50, 0x4B, 0x3, 0x4])) { // Local file header signature
			try {
				while (tokenizer.position + 30 < tokenizer.fileInfo.size) {
					await tokenizer.readBuffer(this.buffer, {length: 30});

					// https://en.wikipedia.org/wiki/Zip_(file_format)#File_headers
					const zipHeader = {
						compressedSize: this.buffer.readUInt32LE(18),
						uncompressedSize: this.buffer.readUInt32LE(22),
						filenameLength: this.buffer.readUInt16LE(26),
						extraFieldLength: this.buffer.readUInt16LE(28),
					};

					zipHeader.filename = await tokenizer.readToken(new StringType(zipHeader.filenameLength, 'utf-8'));
					await tokenizer.ignore(zipHeader.extraFieldLength);

					// Assumes signed `.xpi` from addons.mozilla.org
					if (zipHeader.filename === 'META-INF/mozilla.rsa') {
						return {
							ext: 'xpi',
							mime: 'application/x-xpinstall',
						};
					}

					if (zipHeader.filename.endsWith('.rels') || zipHeader.filename.endsWith('.xml')) {
						const type = zipHeader.filename.split('/')[0];
						switch (type) {
							case '_rels':
								break;
							case 'word':
								return {
									ext: 'docx',
									mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
								};
							case 'ppt':
								return {
									ext: 'pptx',
									mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
								};
							case 'xl':
								return {
									ext: 'xlsx',
									mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
								};
							default:
								break;
						}
					}

					if (zipHeader.filename.startsWith('xl/')) {
						return {
							ext: 'xlsx',
							mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
						};
					}

					if (zipHeader.filename.startsWith('3D/') && zipHeader.filename.endsWith('.model')) {
						return {
							ext: '3mf',
							mime: 'model/3mf',
						};
					}

					// The docx, xlsx and pptx file types extend the Office Open XML file format:
					// https://en.wikipedia.org/wiki/Office_Open_XML_file_formats
					// We look for:
					// - one entry named '[Content_Types].xml' or '_rels/.rels',
					// - one entry indicating specific type of file.
					// MS Office, OpenOffice and LibreOffice may put the parts in different order, so the check should not rely on it.
					if (zipHeader.filename === 'mimetype' && zipHeader.compressedSize === zipHeader.uncompressedSize) {
						let mimeType = await tokenizer.readToken(new StringType(zipHeader.compressedSize, 'utf-8'));
						mimeType = mimeType.trim();

						switch (mimeType) {
							case 'application/epub+zip':
								return {
									ext: 'epub',
									mime: 'application/epub+zip',
								};
							case 'application/vnd.oasis.opendocument.text':
								return {
									ext: 'odt',
									mime: 'application/vnd.oasis.opendocument.text',
								};
							case 'application/vnd.oasis.opendocument.spreadsheet':
								return {
									ext: 'ods',
									mime: 'application/vnd.oasis.opendocument.spreadsheet',
								};
							case 'application/vnd.oasis.opendocument.presentation':
								return {
									ext: 'odp',
									mime: 'application/vnd.oasis.opendocument.presentation',
								};
							default:
						}
					}

					// Try to find next header manually when current one is corrupted
					if (zipHeader.compressedSize === 0) {
						let nextHeaderIndex = -1;

						while (nextHeaderIndex < 0 && (tokenizer.position < tokenizer.fileInfo.size)) {
							await tokenizer.peekBuffer(this.buffer, {mayBeLess: true});

							nextHeaderIndex = this.buffer.indexOf('504B0304', 0, 'hex');
							// Move position to the next header if found, skip the whole buffer otherwise
							await tokenizer.ignore(nextHeaderIndex >= 0 ? nextHeaderIndex : this.buffer.length);
						}
					} else {
						await tokenizer.ignore(zipHeader.compressedSize);
					}
				}
			} catch (error) {
				if (!(error instanceof EndOfStreamError)) {
					throw error;
				}
			}

			return {
				ext: 'zip',
				mime: 'application/zip',
			};
		}

		if (this.checkString('OggS')) {
			// This is an OGG container
			await tokenizer.ignore(28);
			const type = node_buffer.Buffer.alloc(8);
			await tokenizer.readBuffer(type);

			// Needs to be before `ogg` check
			if (_check(type, [0x4F, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64])) {
				return {
					ext: 'opus',
					mime: 'audio/opus',
				};
			}

			// If ' theora' in header.
			if (_check(type, [0x80, 0x74, 0x68, 0x65, 0x6F, 0x72, 0x61])) {
				return {
					ext: 'ogv',
					mime: 'video/ogg',
				};
			}

			// If '\x01video' in header.
			if (_check(type, [0x01, 0x76, 0x69, 0x64, 0x65, 0x6F, 0x00])) {
				return {
					ext: 'ogm',
					mime: 'video/ogg',
				};
			}

			// If ' FLAC' in header  https://xiph.org/flac/faq.html
			if (_check(type, [0x7F, 0x46, 0x4C, 0x41, 0x43])) {
				return {
					ext: 'oga',
					mime: 'audio/ogg',
				};
			}

			// 'Speex  ' in header https://en.wikipedia.org/wiki/Speex
			if (_check(type, [0x53, 0x70, 0x65, 0x65, 0x78, 0x20, 0x20])) {
				return {
					ext: 'spx',
					mime: 'audio/ogg',
				};
			}

			// If '\x01vorbis' in header
			if (_check(type, [0x01, 0x76, 0x6F, 0x72, 0x62, 0x69, 0x73])) {
				return {
					ext: 'ogg',
					mime: 'audio/ogg',
				};
			}

			// Default OGG container https://www.iana.org/assignments/media-types/application/ogg
			return {
				ext: 'ogx',
				mime: 'application/ogg',
			};
		}

		if (
			this.check([0x50, 0x4B])
			&& (this.buffer[2] === 0x3 || this.buffer[2] === 0x5 || this.buffer[2] === 0x7)
			&& (this.buffer[3] === 0x4 || this.buffer[3] === 0x6 || this.buffer[3] === 0x8)
		) {
			return {
				ext: 'zip',
				mime: 'application/zip',
			};
		}

		//

		// File Type Box (https://en.wikipedia.org/wiki/ISO_base_media_file_format)
		// It's not required to be first, but it's recommended to be. Almost all ISO base media files start with `ftyp` box.
		// `ftyp` box must contain a brand major identifier, which must consist of ISO 8859-1 printable characters.
		// Here we check for 8859-1 printable characters (for simplicity, it's a mask which also catches one non-printable character).
		if (
			this.checkString('ftyp', {offset: 4})
			&& (this.buffer[8] & 0x60) !== 0x00 // Brand major, first character ASCII?
		) {
			// They all can have MIME `video/mp4` except `application/mp4` special-case which is hard to detect.
			// For some cases, we're specific, everything else falls to `video/mp4` with `mp4` extension.
			const brandMajor = this.buffer.toString('binary', 8, 12).replace('\0', ' ').trim();
			switch (brandMajor) {
				case 'avif':
				case 'avis':
					return {ext: 'avif', mime: 'image/avif'};
				case 'mif1':
					return {ext: 'heic', mime: 'image/heif'};
				case 'msf1':
					return {ext: 'heic', mime: 'image/heif-sequence'};
				case 'heic':
				case 'heix':
					return {ext: 'heic', mime: 'image/heic'};
				case 'hevc':
				case 'hevx':
					return {ext: 'heic', mime: 'image/heic-sequence'};
				case 'qt':
					return {ext: 'mov', mime: 'video/quicktime'};
				case 'M4V':
				case 'M4VH':
				case 'M4VP':
					return {ext: 'm4v', mime: 'video/x-m4v'};
				case 'M4P':
					return {ext: 'm4p', mime: 'video/mp4'};
				case 'M4B':
					return {ext: 'm4b', mime: 'audio/mp4'};
				case 'M4A':
					return {ext: 'm4a', mime: 'audio/x-m4a'};
				case 'F4V':
					return {ext: 'f4v', mime: 'video/mp4'};
				case 'F4P':
					return {ext: 'f4p', mime: 'video/mp4'};
				case 'F4A':
					return {ext: 'f4a', mime: 'audio/mp4'};
				case 'F4B':
					return {ext: 'f4b', mime: 'audio/mp4'};
				case 'crx':
					return {ext: 'cr3', mime: 'image/x-canon-cr3'};
				default:
					if (brandMajor.startsWith('3g')) {
						if (brandMajor.startsWith('3g2')) {
							return {ext: '3g2', mime: 'video/3gpp2'};
						}

						return {ext: '3gp', mime: 'video/3gpp'};
					}

					return {ext: 'mp4', mime: 'video/mp4'};
			}
		}

		if (this.checkString('MThd')) {
			return {
				ext: 'mid',
				mime: 'audio/midi',
			};
		}

		if (
			this.checkString('wOFF')
			&& (
				this.check([0x00, 0x01, 0x00, 0x00], {offset: 4})
				|| this.checkString('OTTO', {offset: 4})
			)
		) {
			return {
				ext: 'woff',
				mime: 'font/woff',
			};
		}

		if (
			this.checkString('wOF2')
			&& (
				this.check([0x00, 0x01, 0x00, 0x00], {offset: 4})
				|| this.checkString('OTTO', {offset: 4})
			)
		) {
			return {
				ext: 'woff2',
				mime: 'font/woff2',
			};
		}

		if (this.check([0xD4, 0xC3, 0xB2, 0xA1]) || this.check([0xA1, 0xB2, 0xC3, 0xD4])) {
			return {
				ext: 'pcap',
				mime: 'application/vnd.tcpdump.pcap',
			};
		}

		// Sony DSD Stream File (DSF)
		if (this.checkString('DSD ')) {
			return {
				ext: 'dsf',
				mime: 'audio/x-dsf', // Non-standard
			};
		}

		if (this.checkString('LZIP')) {
			return {
				ext: 'lz',
				mime: 'application/x-lzip',
			};
		}

		if (this.checkString('fLaC')) {
			return {
				ext: 'flac',
				mime: 'audio/x-flac',
			};
		}

		if (this.check([0x42, 0x50, 0x47, 0xFB])) {
			return {
				ext: 'bpg',
				mime: 'image/bpg',
			};
		}

		if (this.checkString('wvpk')) {
			return {
				ext: 'wv',
				mime: 'audio/wavpack',
			};
		}

		if (this.checkString('%PDF')) {
			try {
				await tokenizer.ignore(1350);
				const maxBufferSize = 10 * 1024 * 1024;
				const buffer = node_buffer.Buffer.alloc(Math.min(maxBufferSize, tokenizer.fileInfo.size));
				await tokenizer.readBuffer(buffer, {mayBeLess: true});

				// Check if this is an Adobe Illustrator file
				if (buffer.includes(node_buffer.Buffer.from('AIPrivateData'))) {
					return {
						ext: 'ai',
						mime: 'application/postscript',
					};
				}
			} catch (error) {
				// Swallow end of stream error if file is too small for the Adobe AI check
				if (!(error instanceof EndOfStreamError)) {
					throw error;
				}
			}

			// Assume this is just a normal PDF
			return {
				ext: 'pdf',
				mime: 'application/pdf',
			};
		}

		if (this.check([0x00, 0x61, 0x73, 0x6D])) {
			return {
				ext: 'wasm',
				mime: 'application/wasm',
			};
		}

		// TIFF, little-endian type
		if (this.check([0x49, 0x49])) {
			const fileType = await this.readTiffHeader(false);
			if (fileType) {
				return fileType;
			}
		}

		// TIFF, big-endian type
		if (this.check([0x4D, 0x4D])) {
			const fileType = await this.readTiffHeader(true);
			if (fileType) {
				return fileType;
			}
		}

		if (this.checkString('MAC ')) {
			return {
				ext: 'ape',
				mime: 'audio/ape',
			};
		}

		// https://github.com/file/file/blob/master/magic/Magdir/matroska
		if (this.check([0x1A, 0x45, 0xDF, 0xA3])) { // Root element: EBML
			async function readField() {
				const msb = await tokenizer.peekNumber(UINT8);
				let mask = 0x80;
				let ic = 0; // 0 = A, 1 = B, 2 = C, 3
				// = D

				while ((msb & mask) === 0 && mask !== 0) {
					++ic;
					mask >>= 1;
				}

				const id = node_buffer.Buffer.alloc(ic + 1);
				await tokenizer.readBuffer(id);
				return id;
			}

			async function readElement() {
				const id = await readField();
				const lengthField = await readField();
				lengthField[0] ^= 0x80 >> (lengthField.length - 1);
				const nrLength = Math.min(6, lengthField.length); // JavaScript can max read 6 bytes integer
				return {
					id: id.readUIntBE(0, id.length),
					len: lengthField.readUIntBE(lengthField.length - nrLength, nrLength),
				};
			}

			async function readChildren(children) {
				while (children > 0) {
					const element = await readElement();
					if (element.id === 0x42_82) {
						const rawValue = await tokenizer.readToken(new StringType(element.len, 'utf-8'));
						return rawValue.replace(/\00.*$/g, ''); // Return DocType
					}

					await tokenizer.ignore(element.len); // ignore payload
					--children;
				}
			}

			const re = await readElement();
			const docType = await readChildren(re.len);

			switch (docType) {
				case 'webm':
					return {
						ext: 'webm',
						mime: 'video/webm',
					};

				case 'matroska':
					return {
						ext: 'mkv',
						mime: 'video/x-matroska',
					};

				default:
					return;
			}
		}

		// RIFF file format which might be AVI, WAV, QCP, etc
		if (this.check([0x52, 0x49, 0x46, 0x46])) {
			if (this.check([0x41, 0x56, 0x49], {offset: 8})) {
				return {
					ext: 'avi',
					mime: 'video/vnd.avi',
				};
			}

			if (this.check([0x57, 0x41, 0x56, 0x45], {offset: 8})) {
				return {
					ext: 'wav',
					mime: 'audio/vnd.wave',
				};
			}

			// QLCM, QCP file
			if (this.check([0x51, 0x4C, 0x43, 0x4D], {offset: 8})) {
				return {
					ext: 'qcp',
					mime: 'audio/qcelp',
				};
			}
		}

		if (this.checkString('SQLi')) {
			return {
				ext: 'sqlite',
				mime: 'application/x-sqlite3',
			};
		}

		if (this.check([0x4E, 0x45, 0x53, 0x1A])) {
			return {
				ext: 'nes',
				mime: 'application/x-nintendo-nes-rom',
			};
		}

		if (this.checkString('Cr24')) {
			return {
				ext: 'crx',
				mime: 'application/x-google-chrome-extension',
			};
		}

		if (
			this.checkString('MSCF')
			|| this.checkString('ISc(')
		) {
			return {
				ext: 'cab',
				mime: 'application/vnd.ms-cab-compressed',
			};
		}

		if (this.check([0xED, 0xAB, 0xEE, 0xDB])) {
			return {
				ext: 'rpm',
				mime: 'application/x-rpm',
			};
		}

		if (this.check([0xC5, 0xD0, 0xD3, 0xC6])) {
			return {
				ext: 'eps',
				mime: 'application/eps',
			};
		}

		if (this.check([0x28, 0xB5, 0x2F, 0xFD])) {
			return {
				ext: 'zst',
				mime: 'application/zstd',
			};
		}

		if (this.check([0x7F, 0x45, 0x4C, 0x46])) {
			return {
				ext: 'elf',
				mime: 'application/x-elf',
			};
		}

		if (this.check([0x21, 0x42, 0x44, 0x4E])) {
			return {
				ext: 'pst',
				mime: 'application/vnd.ms-outlook',
			};
		}

		if (this.checkString('PAR1')) {
			return {
				ext: 'parquet',
				mime: 'application/x-parquet',
			};
		}

		if (this.check([0xCF, 0xFA, 0xED, 0xFE])) {
			return {
				ext: 'macho',
				mime: 'application/x-mach-binary',
			};
		}

		// -- 5-byte signatures --

		if (this.check([0x4F, 0x54, 0x54, 0x4F, 0x00])) {
			return {
				ext: 'otf',
				mime: 'font/otf',
			};
		}

		if (this.checkString('#!AMR')) {
			return {
				ext: 'amr',
				mime: 'audio/amr',
			};
		}

		if (this.checkString('{\\rtf')) {
			return {
				ext: 'rtf',
				mime: 'application/rtf',
			};
		}

		if (this.check([0x46, 0x4C, 0x56, 0x01])) {
			return {
				ext: 'flv',
				mime: 'video/x-flv',
			};
		}

		if (this.checkString('IMPM')) {
			return {
				ext: 'it',
				mime: 'audio/x-it',
			};
		}

		if (
			this.checkString('-lh0-', {offset: 2})
			|| this.checkString('-lh1-', {offset: 2})
			|| this.checkString('-lh2-', {offset: 2})
			|| this.checkString('-lh3-', {offset: 2})
			|| this.checkString('-lh4-', {offset: 2})
			|| this.checkString('-lh5-', {offset: 2})
			|| this.checkString('-lh6-', {offset: 2})
			|| this.checkString('-lh7-', {offset: 2})
			|| this.checkString('-lzs-', {offset: 2})
			|| this.checkString('-lz4-', {offset: 2})
			|| this.checkString('-lz5-', {offset: 2})
			|| this.checkString('-lhd-', {offset: 2})
		) {
			return {
				ext: 'lzh',
				mime: 'application/x-lzh-compressed',
			};
		}

		// MPEG program stream (PS or MPEG-PS)
		if (this.check([0x00, 0x00, 0x01, 0xBA])) {
			//  MPEG-PS, MPEG-1 Part 1
			if (this.check([0x21], {offset: 4, mask: [0xF1]})) {
				return {
					ext: 'mpg', // May also be .ps, .mpeg
					mime: 'video/MP1S',
				};
			}

			// MPEG-PS, MPEG-2 Part 1
			if (this.check([0x44], {offset: 4, mask: [0xC4]})) {
				return {
					ext: 'mpg', // May also be .mpg, .m2p, .vob or .sub
					mime: 'video/MP2P',
				};
			}
		}

		if (this.checkString('ITSF')) {
			return {
				ext: 'chm',
				mime: 'application/vnd.ms-htmlhelp',
			};
		}

		if (this.check([0xCA, 0xFE, 0xBA, 0xBE])) {
			return {
				ext: 'class',
				mime: 'application/java-vm',
			};
		}

		// -- 6-byte signatures --

		if (this.check([0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00])) {
			return {
				ext: 'xz',
				mime: 'application/x-xz',
			};
		}

		if (this.checkString('<?xml ')) {
			return {
				ext: 'xml',
				mime: 'application/xml',
			};
		}

		if (this.check([0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C])) {
			return {
				ext: '7z',
				mime: 'application/x-7z-compressed',
			};
		}

		if (
			this.check([0x52, 0x61, 0x72, 0x21, 0x1A, 0x7])
			&& (this.buffer[6] === 0x0 || this.buffer[6] === 0x1)
		) {
			return {
				ext: 'rar',
				mime: 'application/x-rar-compressed',
			};
		}

		if (this.checkString('solid ')) {
			return {
				ext: 'stl',
				mime: 'model/stl',
			};
		}

		if (this.checkString('AC')) {
			const version = this.buffer.toString('binary', 2, 6);
			if (version.match('^d*') && version >= 1000 && version <= 1050) {
				return {
					ext: 'dwg',
					mime: 'image/vnd.dwg',
				};
			}
		}

		if (this.checkString('070707')) {
			return {
				ext: 'cpio',
				mime: 'application/x-cpio',
			};
		}

		// -- 7-byte signatures --

		if (this.checkString('BLENDER')) {
			return {
				ext: 'blend',
				mime: 'application/x-blender',
			};
		}

		if (this.checkString('!<arch>')) {
			await tokenizer.ignore(8);
			const string = await tokenizer.readToken(new StringType(13, 'ascii'));
			if (string === 'debian-binary') {
				return {
					ext: 'deb',
					mime: 'application/x-deb',
				};
			}

			return {
				ext: 'ar',
				mime: 'application/x-unix-archive',
			};
		}

		if (this.checkString('**ACE', {offset: 7})) {
			await tokenizer.peekBuffer(this.buffer, {length: 14, mayBeLess: true});
			if (this.checkString('**', {offset: 12})) {
				return {
					ext: 'ace',
					mime: 'application/x-ace-compressed',
				};
			}
		}

		// -- 8-byte signatures --

		if (this.check([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) {
			// APNG format (https://wiki.mozilla.org/APNG_Specification)
			// 1. Find the first IDAT (image data) chunk (49 44 41 54)
			// 2. Check if there is an "acTL" chunk before the IDAT one (61 63 54 4C)

			// Offset calculated as follows:
			// - 8 bytes: PNG signature
			// - 4 (length) + 4 (chunk type) + 13 (chunk data) + 4 (CRC): IHDR chunk

			await tokenizer.ignore(8); // ignore PNG signature

			async function readChunkHeader() {
				return {
					length: await tokenizer.readToken(INT32_BE),
					type: await tokenizer.readToken(new StringType(4, 'binary')),
				};
			}

			do {
				const chunk = await readChunkHeader();
				if (chunk.length < 0) {
					return; // Invalid chunk length
				}

				switch (chunk.type) {
					case 'IDAT':
						return {
							ext: 'png',
							mime: 'image/png',
						};
					case 'acTL':
						return {
							ext: 'apng',
							mime: 'image/apng',
						};
					default:
						await tokenizer.ignore(chunk.length + 4); // Ignore chunk-data + CRC
				}
			} while (tokenizer.position + 8 < tokenizer.fileInfo.size);

			return {
				ext: 'png',
				mime: 'image/png',
			};
		}

		if (this.check([0x41, 0x52, 0x52, 0x4F, 0x57, 0x31, 0x00, 0x00])) {
			return {
				ext: 'arrow',
				mime: 'application/x-apache-arrow',
			};
		}

		if (this.check([0x67, 0x6C, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00])) {
			return {
				ext: 'glb',
				mime: 'model/gltf-binary',
			};
		}

		// `mov` format variants
		if (
			this.check([0x66, 0x72, 0x65, 0x65], {offset: 4}) // `free`
			|| this.check([0x6D, 0x64, 0x61, 0x74], {offset: 4}) // `mdat` MJPEG
			|| this.check([0x6D, 0x6F, 0x6F, 0x76], {offset: 4}) // `moov`
			|| this.check([0x77, 0x69, 0x64, 0x65], {offset: 4}) // `wide`
		) {
			return {
				ext: 'mov',
				mime: 'video/quicktime',
			};
		}

		// -- 9-byte signatures --

		if (this.check([0x49, 0x49, 0x52, 0x4F, 0x08, 0x00, 0x00, 0x00, 0x18])) {
			return {
				ext: 'orf',
				mime: 'image/x-olympus-orf',
			};
		}

		if (this.checkString('gimp xcf ')) {
			return {
				ext: 'xcf',
				mime: 'image/x-xcf',
			};
		}

		// -- 12-byte signatures --

		if (this.check([0x49, 0x49, 0x55, 0x00, 0x18, 0x00, 0x00, 0x00, 0x88, 0xE7, 0x74, 0xD8])) {
			return {
				ext: 'rw2',
				mime: 'image/x-panasonic-rw2',
			};
		}

		// ASF_Header_Object first 80 bytes
		if (this.check([0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11, 0xA6, 0xD9])) {
			async function readHeader() {
				const guid = node_buffer.Buffer.alloc(16);
				await tokenizer.readBuffer(guid);
				return {
					id: guid,
					size: Number(await tokenizer.readToken(UINT64_LE)),
				};
			}

			await tokenizer.ignore(30);
			// Search for header should be in first 1KB of file.
			while (tokenizer.position + 24 < tokenizer.fileInfo.size) {
				const header = await readHeader();
				let payload = header.size - 24;
				if (_check(header.id, [0x91, 0x07, 0xDC, 0xB7, 0xB7, 0xA9, 0xCF, 0x11, 0x8E, 0xE6, 0x00, 0xC0, 0x0C, 0x20, 0x53, 0x65])) {
					// Sync on Stream-Properties-Object (B7DC0791-A9B7-11CF-8EE6-00C00C205365)
					const typeId = node_buffer.Buffer.alloc(16);
					payload -= await tokenizer.readBuffer(typeId);

					if (_check(typeId, [0x40, 0x9E, 0x69, 0xF8, 0x4D, 0x5B, 0xCF, 0x11, 0xA8, 0xFD, 0x00, 0x80, 0x5F, 0x5C, 0x44, 0x2B])) {
						// Found audio:
						return {
							ext: 'asf',
							mime: 'audio/x-ms-asf',
						};
					}

					if (_check(typeId, [0xC0, 0xEF, 0x19, 0xBC, 0x4D, 0x5B, 0xCF, 0x11, 0xA8, 0xFD, 0x00, 0x80, 0x5F, 0x5C, 0x44, 0x2B])) {
						// Found video:
						return {
							ext: 'asf',
							mime: 'video/x-ms-asf',
						};
					}

					break;
				}

				await tokenizer.ignore(payload);
			}

			// Default to ASF generic extension
			return {
				ext: 'asf',
				mime: 'application/vnd.ms-asf',
			};
		}

		if (this.check([0xAB, 0x4B, 0x54, 0x58, 0x20, 0x31, 0x31, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A])) {
			return {
				ext: 'ktx',
				mime: 'image/ktx',
			};
		}

		if ((this.check([0x7E, 0x10, 0x04]) || this.check([0x7E, 0x18, 0x04])) && this.check([0x30, 0x4D, 0x49, 0x45], {offset: 4})) {
			return {
				ext: 'mie',
				mime: 'application/x-mie',
			};
		}

		if (this.check([0x27, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], {offset: 2})) {
			return {
				ext: 'shp',
				mime: 'application/x-esri-shape',
			};
		}

		if (this.check([0xFF, 0x4F, 0xFF, 0x51])) {
			return {
				ext: 'j2c',
				mime: 'image/j2c',
			};
		}

		if (this.check([0x00, 0x00, 0x00, 0x0C, 0x6A, 0x50, 0x20, 0x20, 0x0D, 0x0A, 0x87, 0x0A])) {
			// JPEG-2000 family

			await tokenizer.ignore(20);
			const type = await tokenizer.readToken(new StringType(4, 'ascii'));
			switch (type) {
				case 'jp2 ':
					return {
						ext: 'jp2',
						mime: 'image/jp2',
					};
				case 'jpx ':
					return {
						ext: 'jpx',
						mime: 'image/jpx',
					};
				case 'jpm ':
					return {
						ext: 'jpm',
						mime: 'image/jpm',
					};
				case 'mjp2':
					return {
						ext: 'mj2',
						mime: 'image/mj2',
					};
				default:
					return;
			}
		}

		if (
			this.check([0xFF, 0x0A])
			|| this.check([0x00, 0x00, 0x00, 0x0C, 0x4A, 0x58, 0x4C, 0x20, 0x0D, 0x0A, 0x87, 0x0A])
		) {
			return {
				ext: 'jxl',
				mime: 'image/jxl',
			};
		}

		if (this.check([0xFE, 0xFF])) { // UTF-16-BOM-LE
			if (this.check([0, 60, 0, 63, 0, 120, 0, 109, 0, 108], {offset: 2})) {
				return {
					ext: 'xml',
					mime: 'application/xml',
				};
			}

			return undefined; // Some unknown text based format
		}

		// -- Unsafe signatures --

		if (
			this.check([0x0, 0x0, 0x1, 0xBA])
			|| this.check([0x0, 0x0, 0x1, 0xB3])
		) {
			return {
				ext: 'mpg',
				mime: 'video/mpeg',
			};
		}

		if (this.check([0x00, 0x01, 0x00, 0x00, 0x00])) {
			return {
				ext: 'ttf',
				mime: 'font/ttf',
			};
		}

		if (this.check([0x00, 0x00, 0x01, 0x00])) {
			return {
				ext: 'ico',
				mime: 'image/x-icon',
			};
		}

		if (this.check([0x00, 0x00, 0x02, 0x00])) {
			return {
				ext: 'cur',
				mime: 'image/x-icon',
			};
		}

		if (this.check([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])) {
			// Detected Microsoft Compound File Binary File (MS-CFB) Format.
			return {
				ext: 'cfb',
				mime: 'application/x-cfb',
			};
		}

		// Increase sample size from 12 to 256.
		await tokenizer.peekBuffer(this.buffer, {length: Math.min(256, tokenizer.fileInfo.size), mayBeLess: true});

		if (this.check([0x61, 0x63, 0x73, 0x70], {offset: 36})) {
			return {
				ext: 'icc',
				mime: 'application/vnd.iccprofile',
			};
		}

		// -- 15-byte signatures --

		if (this.checkString('BEGIN:')) {
			if (this.checkString('VCARD', {offset: 6})) {
				return {
					ext: 'vcf',
					mime: 'text/vcard',
				};
			}

			if (this.checkString('VCALENDAR', {offset: 6})) {
				return {
					ext: 'ics',
					mime: 'text/calendar',
				};
			}
		}

		// `raf` is here just to keep all the raw image detectors together.
		if (this.checkString('FUJIFILMCCD-RAW')) {
			return {
				ext: 'raf',
				mime: 'image/x-fujifilm-raf',
			};
		}

		if (this.checkString('Extended Module:')) {
			return {
				ext: 'xm',
				mime: 'audio/x-xm',
			};
		}

		if (this.checkString('Creative Voice File')) {
			return {
				ext: 'voc',
				mime: 'audio/x-voc',
			};
		}

		if (this.check([0x04, 0x00, 0x00, 0x00]) && this.buffer.length >= 16) { // Rough & quick check Pickle/ASAR
			const jsonSize = this.buffer.readUInt32LE(12);
			if (jsonSize > 12 && this.buffer.length >= jsonSize + 16) {
				try {
					const header = this.buffer.slice(16, jsonSize + 16).toString();
					const json = JSON.parse(header);
					// Check if Pickle is ASAR
					if (json.files) { // Final check, assuring Pickle/ASAR format
						return {
							ext: 'asar',
							mime: 'application/x-asar',
						};
					}
				} catch {}
			}
		}

		if (this.check([0x06, 0x0E, 0x2B, 0x34, 0x02, 0x05, 0x01, 0x01, 0x0D, 0x01, 0x02, 0x01, 0x01, 0x02])) {
			return {
				ext: 'mxf',
				mime: 'application/mxf',
			};
		}

		if (this.checkString('SCRM', {offset: 44})) {
			return {
				ext: 's3m',
				mime: 'audio/x-s3m',
			};
		}

		// Raw MPEG-2 transport stream (188-byte packets)
		if (this.check([0x47]) && this.check([0x47], {offset: 188})) {
			return {
				ext: 'mts',
				mime: 'video/mp2t',
			};
		}

		// Blu-ray Disc Audio-Video (BDAV) MPEG-2 transport stream has 4-byte TP_extra_header before each 188-byte packet
		if (this.check([0x47], {offset: 4}) && this.check([0x47], {offset: 196})) {
			return {
				ext: 'mts',
				mime: 'video/mp2t',
			};
		}

		if (this.check([0x42, 0x4F, 0x4F, 0x4B, 0x4D, 0x4F, 0x42, 0x49], {offset: 60})) {
			return {
				ext: 'mobi',
				mime: 'application/x-mobipocket-ebook',
			};
		}

		if (this.check([0x44, 0x49, 0x43, 0x4D], {offset: 128})) {
			return {
				ext: 'dcm',
				mime: 'application/dicom',
			};
		}

		if (this.check([0x4C, 0x00, 0x00, 0x00, 0x01, 0x14, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46])) {
			return {
				ext: 'lnk',
				mime: 'application/x.ms.shortcut', // Invented by us
			};
		}

		if (this.check([0x62, 0x6F, 0x6F, 0x6B, 0x00, 0x00, 0x00, 0x00, 0x6D, 0x61, 0x72, 0x6B, 0x00, 0x00, 0x00, 0x00])) {
			return {
				ext: 'alias',
				mime: 'application/x.apple.alias', // Invented by us
			};
		}

		if (this.checkString('Kaydara FBX Binary  \u0000')) {
			return {
				ext: 'fbx',
				mime: 'application/x.autodesk.fbx', // Invented by us
			};
		}

		if (
			this.check([0x4C, 0x50], {offset: 34})
			&& (
				this.check([0x00, 0x00, 0x01], {offset: 8})
				|| this.check([0x01, 0x00, 0x02], {offset: 8})
				|| this.check([0x02, 0x00, 0x02], {offset: 8})
			)
		) {
			return {
				ext: 'eot',
				mime: 'application/vnd.ms-fontobject',
			};
		}

		if (this.check([0x06, 0x06, 0xED, 0xF5, 0xD8, 0x1D, 0x46, 0xE5, 0xBD, 0x31, 0xEF, 0xE7, 0xFE, 0x74, 0xB7, 0x1D])) {
			return {
				ext: 'indd',
				mime: 'application/x-indesign',
			};
		}

		// Increase sample size from 256 to 512
		await tokenizer.peekBuffer(this.buffer, {length: Math.min(512, tokenizer.fileInfo.size), mayBeLess: true});

		// Requires a buffer size of 512 bytes
		if (tarHeaderChecksumMatches(this.buffer)) {
			return {
				ext: 'tar',
				mime: 'application/x-tar',
			};
		}

		if (this.check([0xFF, 0xFE])) { // UTF-16-BOM-BE
			if (this.check([60, 0, 63, 0, 120, 0, 109, 0, 108, 0], {offset: 2})) {
				return {
					ext: 'xml',
					mime: 'application/xml',
				};
			}

			if (this.check([0xFF, 0x0E, 0x53, 0x00, 0x6B, 0x00, 0x65, 0x00, 0x74, 0x00, 0x63, 0x00, 0x68, 0x00, 0x55, 0x00, 0x70, 0x00, 0x20, 0x00, 0x4D, 0x00, 0x6F, 0x00, 0x64, 0x00, 0x65, 0x00, 0x6C, 0x00], {offset: 2})) {
				return {
					ext: 'skp',
					mime: 'application/vnd.sketchup.skp',
				};
			}

			return undefined; // Some text based format
		}

		if (this.checkString('-----BEGIN PGP MESSAGE-----')) {
			return {
				ext: 'pgp',
				mime: 'application/pgp-encrypted',
			};
		}

		// Check MPEG 1 or 2 Layer 3 header, or 'layer 0' for ADTS (MPEG sync-word 0xFFE)
		if (this.buffer.length >= 2 && this.check([0xFF, 0xE0], {offset: 0, mask: [0xFF, 0xE0]})) {
			if (this.check([0x10], {offset: 1, mask: [0x16]})) {
				// Check for (ADTS) MPEG-2
				if (this.check([0x08], {offset: 1, mask: [0x08]})) {
					return {
						ext: 'aac',
						mime: 'audio/aac',
					};
				}

				// Must be (ADTS) MPEG-4
				return {
					ext: 'aac',
					mime: 'audio/aac',
				};
			}

			// MPEG 1 or 2 Layer 3 header
			// Check for MPEG layer 3
			if (this.check([0x02], {offset: 1, mask: [0x06]})) {
				return {
					ext: 'mp3',
					mime: 'audio/mpeg',
				};
			}

			// Check for MPEG layer 2
			if (this.check([0x04], {offset: 1, mask: [0x06]})) {
				return {
					ext: 'mp2',
					mime: 'audio/mpeg',
				};
			}

			// Check for MPEG layer 1
			if (this.check([0x06], {offset: 1, mask: [0x06]})) {
				return {
					ext: 'mp1',
					mime: 'audio/mpeg',
				};
			}
		}
	}

	async readTiffTag(bigEndian) {
		const tagId = await this.tokenizer.readToken(bigEndian ? UINT16_BE : UINT16_LE);
		this.tokenizer.ignore(10);
		switch (tagId) {
			case 50_341:
				return {
					ext: 'arw',
					mime: 'image/x-sony-arw',
				};
			case 50_706:
				return {
					ext: 'dng',
					mime: 'image/x-adobe-dng',
				};
		}
	}

	async readTiffIFD(bigEndian) {
		const numberOfTags = await this.tokenizer.readToken(bigEndian ? UINT16_BE : UINT16_LE);
		for (let n = 0; n < numberOfTags; ++n) {
			const fileType = await this.readTiffTag(bigEndian);
			if (fileType) {
				return fileType;
			}
		}
	}

	async readTiffHeader(bigEndian) {
		const version = (bigEndian ? UINT16_BE : UINT16_LE).get(this.buffer, 2);
		const ifdOffset = (bigEndian ? UINT32_BE : UINT32_LE).get(this.buffer, 4);

		if (version === 42) {
			// TIFF file header
			if (ifdOffset >= 6) {
				if (this.checkString('CR', {offset: 8})) {
					return {
						ext: 'cr2',
						mime: 'image/x-canon-cr2',
					};
				}

				if (ifdOffset >= 8 && (this.check([0x1C, 0x00, 0xFE, 0x00], {offset: 8}) || this.check([0x1F, 0x00, 0x0B, 0x00], {offset: 8}))) {
					return {
						ext: 'nef',
						mime: 'image/x-nikon-nef',
					};
				}
			}

			await this.tokenizer.ignore(ifdOffset);
			const fileType = await this.readTiffIFD(bigEndian);
			return fileType ?? {
				ext: 'tif',
				mime: 'image/tiff',
			};
		}

		if (version === 43) {	// Big TIFF file header
			return {
				ext: 'tif',
				mime: 'image/tiff',
			};
		}
	}
}

new Set(extensions);
new Set(mimeTypes);

const imageExtensions = new Set([
	'jpg',
	'png',
	'gif',
	'webp',
	'flif',
	'cr2',
	'tif',
	'bmp',
	'jxr',
	'psd',
	'ico',
	'bpg',
	'jp2',
	'jpm',
	'jpx',
	'heic',
	'cur',
	'dcm',
	'avif',
]);

async function imageType(input) {
	const result = await fileTypeFromBuffer(input);
	return imageExtensions.has(result?.ext) && result;
}

// العربية
var ar = {};

// čeština
var cz = {};

// Dansk
var da = {};

// Deutsch
var de = {};

// English
var en = {
    // setting.ts
    "Plugin Settings": "Plugin Settings",
    "Auto pasted upload": "Auto pasted upload",
    "If you set this value true, when you paste image, it will be auto uploaded(you should set the picGo server rightly)": "If you set this value true, when you paste image, it will be auto uploaded(you should set the picGo server rightly)",
    "Default uploader": "Default uploader",
    "PicGo server": "PicGo server upload route",
    "PicGo server desc": "upload route, use PicList will be able to set picbed and config through query",
    "Please input PicGo server": "Please input upload route",
    "PicGo delete server": "PicGo server delete route(you need to use PicList app)",
    "PicList desc": "Search PicList on Github to download and install",
    "Please input PicGo delete server": "Please input delete server",
    "Delete image using PicList": "Delete image using PicList",
    "PicGo-Core path": "PicGo-Core path",
    "Delete successfully": "Delete successfully",
    "Delete failed": "Delete failed",
    "Image size suffix": "Image size suffix",
    "Image size suffix Description": "like |300 for resize image in ob.",
    "Please input image size suffix": "Please input image size suffix",
    "Error, could not delete": "Error, could not delete",
    "Please input PicGo-Core path, default using environment variables": "Please input PicGo-Core path, default using environment variables",
    "Work on network": "Work on network",
    "Work on network Description": "Allow upload network image by 'Upload all' command.\n Or when you paste, md standard image link in your clipboard will be auto upload.",
    fixPath: "fixPath",
    fixPathWarning: "This option is used to fix PicGo-core upload failures on Linux and Mac. It modifies the PATH variable within Obsidian. If Obsidian encounters any bugs, turn off the option, try again! ",
    "Upload when clipboard has image and text together": "Upload when clipboard has image and text together",
    "When you copy, some application like Excel will image and text to clipboard, you can upload or not.": "When you copy, some application like Excel will image and text to clipboard, you can upload or not.",
    "Network Domain Black List": "Network Domain Black List",
    "Network Domain Black List Description": "Image in the domain list will not be upload,use comma separated",
    "Delete source file after you upload file": "Delete source file after you upload file",
    "Delete source file in ob assets after you upload file.": "Delete source file in ob assets after you upload file.",
    "Image desc": "Image desc",
    reserve: "default",
    "remove all": "none",
    "remove default": "remove image.png",
    "Remote server mode": "Remote server mode",
    "Remote server mode desc": "If you have deployed piclist-core or piclist on the server.",
    "Can not find image file": "Can not find image file",
    "File has been changedd, upload failure": "File has been changedd, upload failure",
    "File has been changedd, download failure": "File has been changedd, download failure",
    "Warning: upload files is different of reciver files from api": "Warning: upload files num is different of reciver files from api",
};

// British English
var enGB = {};

// Español
var es = {};

// français
var fr = {};

// हिन्दी
var hi = {};

// Bahasa Indonesia
var id = {};

// Italiano
var it = {};

// 日本語
var ja = {};

// 한국어
var ko = {};

// Nederlands
var nl = {};

// Norsk
var no = {};

// język polski
var pl = {};

// Português
var pt = {};

// Português do Brasil
// Brazilian Portuguese
var ptBR = {};

// Română
var ro = {};

// русский
var ru = {};

// Türkçe
var tr = {};

// 简体中文
var zhCN = {
    // setting.ts
    "Plugin Settings": "插件设置",
    "Auto pasted upload": "剪切板自动上传",
    "If you set this value true, when you paste image, it will be auto uploaded(you should set the picGo server rightly)": "启用该选项后，黏贴图片时会自动上传（你需要正确配置picgo）",
    "Default uploader": "默认上传器",
    "PicGo server": "PicGo server 上传接口",
    "PicGo server desc": "上传接口，使用PicList时可通过设置URL参数指定图床和配置",
    "Please input PicGo server": "请输入上传接口地址",
    "PicGo delete server": "PicGo server 删除接口(请使用PicList来启用此功能)",
    "PicList desc": "PicList是PicGo二次开发版，请Github搜索PicList下载",
    "Please input PicGo delete server": "请输入删除接口地址",
    "Delete image using PicList": "使用 PicList 删除图片",
    "PicGo-Core path": "PicGo-Core 路径",
    "Delete successfully": "删除成功",
    "Delete failed": "删除失败",
    "Error, could not delete": "错误，无法删除",
    "Image size suffix": "图片大小后缀",
    "Image size suffix Description": "比如：|300 用于调整图片大小",
    "Please input image size suffix": "请输入图片大小后缀",
    "Please input PicGo-Core path, default using environment variables": "请输入 PicGo-Core path，默认使用环境变量",
    "Work on network": "应用网络图片",
    "Work on network Description": "当你上传所有图片时，也会上传网络图片。以及当你进行黏贴时，剪切板中的标准 md 图片会被上传",
    fixPath: "修正PATH变量",
    fixPathWarning: "此选项用于修复Linux和Mac上 PicGo-Core 上传失败的问题。它会修改 Obsidian 内的 PATH 变量，如果 Obsidian 遇到任何BUG，先关闭这个选项试试！",
    "Upload when clipboard has image and text together": "当剪切板同时拥有文本和图片剪切板数据时是否上传图片",
    "When you copy, some application like Excel will image and text to clipboard, you can upload or not.": "当你复制时，某些应用例如 Excel 会在剪切板同时文本和图像数据，确认是否上传。",
    "Network Domain Black List": "网络图片域名黑名单",
    "Network Domain Black List Description": "黑名单域名中的图片将不会被上传，用英文逗号分割",
    "Delete source file after you upload file": "上传文件后移除源文件",
    "Delete source file in ob assets after you upload file.": "上传文件后移除在ob附件文件夹中的文件",
    "Image desc": "图片描述",
    reserve: "默认",
    "remove all": "无",
    "remove default": "移除image.png",
    "Remote server mode": "远程服务器模式",
    "Remote server mode desc": "如果你在服务器部署了piclist-core或者piclist",
    "Can not find image file": "没有解析到图像文件",
    "File has been changedd, upload failure": "当前文件已变更，上传失败",
    "File has been changedd, download failure": "当前文件已变更，下载失败",
    "Warning: upload files is different of reciver files from api": "警告：上传的文件与接口返回的文件数量不一致",
};

// 繁體中文
var zhTW = {};

const localeMap = {
    ar,
    cs: cz,
    da,
    de,
    en,
    'en-gb': enGB,
    es,
    fr,
    hi,
    id,
    it,
    ja,
    ko,
    nl,
    nn: no,
    pl,
    pt,
    'pt-br': ptBR,
    ro,
    ru,
    tr,
    'zh-cn': zhCN,
    'zh-tw': zhTW,
};
const locale = localeMap[obsidian.moment.locale()];
function t(str) {
    return (locale && locale[str]) || en[str];
}

async function downloadAllImageFiles(plugin) {
    const activeFile = plugin.app.workspace.getActiveFile();
    const folderPath = await plugin.app.fileManager.getAvailablePathForAttachment("");
    const fileArray = plugin.helper.getAllFiles();
    if (!(await plugin.app.vault.adapter.exists(folderPath))) {
        await plugin.app.vault.adapter.mkdir(folderPath);
    }
    let imageArray = [];
    for (const file of fileArray) {
        if (!file.path.startsWith("http")) {
            continue;
        }
        const url = file.path;
        const asset = getUrlAsset(url);
        let name = decodeURI(pathBrowserify.parse(asset).name).replaceAll(/[\\\\/:*?\"<>|]/g, "-");
        const response = await download(plugin, url, folderPath, name);
        if (response.ok) {
            const activeFolder = plugin.app.workspace.getActiveFile().parent.path;
            imageArray.push({
                source: file.source,
                name: name,
                path: obsidian.normalizePath(pathBrowserify.relative(obsidian.normalizePath(activeFolder), obsidian.normalizePath(response.path))),
            });
        }
    }
    let value = plugin.helper.getValue();
    imageArray.map(image => {
        let name = plugin.handleName(image.name);
        value = value.replace(image.source, `![${name}](${encodeURI(image.path)})`);
    });
    const currentFile = plugin.app.workspace.getActiveFile();
    if (activeFile.path !== currentFile.path) {
        new obsidian.Notice(t("File has been changedd, download failure"));
        return;
    }
    plugin.helper.setValue(value);
    new obsidian.Notice(`all: ${fileArray.length}\nsuccess: ${imageArray.length}\nfailed: ${fileArray.length - imageArray.length}`);
}
async function download(plugin, url, folderPath, name) {
    const response = await obsidian.requestUrl({ url });
    if (response.status !== 200) {
        return {
            ok: false,
            msg: "error",
        };
    }
    const type = await imageType(new Uint8Array(response.arrayBuffer));
    if (!type) {
        return {
            ok: false,
            msg: "error",
        };
    }
    try {
        let path = obsidian.normalizePath(pathBrowserify.join(folderPath, `${name}.${type.ext}`));
        // 如果文件名已存在，则用随机值替换，不对文件后缀进行判断
        if (await plugin.app.vault.adapter.exists(path)) {
            path = obsidian.normalizePath(pathBrowserify.join(folderPath, `${uuid()}.${type.ext}`));
        }
        plugin.app.vault.adapter.writeBinary(path, response.arrayBuffer);
        return {
            ok: true,
            msg: "ok",
            path: path,
            type,
        };
    }
    catch (err) {
        return {
            ok: false,
            msg: err,
        };
    }
}

class PicGoUploader {
    settings;
    plugin;
    constructor(settings, plugin) {
        this.settings = settings;
        this.plugin = plugin;
    }
    async uploadFiles(fileList) {
        let response;
        let data;
        if (this.settings.remoteServerMode) {
            const files = [];
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                const buffer = await new Promise((resolve, reject) => {
                    require$$0.readFile(file, (err, data) => {
                        if (err) {
                            reject(err);
                        }
                        resolve(data);
                    });
                });
                const arrayBuffer = bufferToArrayBuffer(buffer);
                files.push(new File([arrayBuffer], file));
            }
            response = await this.uploadFileByData(files);
            data = await response.json();
        }
        else {
            response = await obsidian.requestUrl({
                url: this.settings.uploadServer,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ list: fileList }),
            });
            data = await response.json;
        }
        // piclist
        if (data.fullResult) {
            const uploadUrlFullResultList = data.fullResult || [];
            this.settings.uploadedImages = [
                ...(this.settings.uploadedImages || []),
                ...uploadUrlFullResultList,
            ];
        }
        return data;
    }
    async uploadFileByData(fileList) {
        const form = new FormData();
        for (let i = 0; i < fileList.length; i++) {
            form.append("list", fileList[i]);
        }
        const options = {
            method: "post",
            body: form,
        };
        const response = await fetch(this.settings.uploadServer, options);
        console.log("response", response);
        return response;
    }
    async uploadFileByClipboard(fileList) {
        let data;
        let res;
        if (this.settings.remoteServerMode) {
            res = await this.uploadFileByData(fileList);
            data = await res.json();
        }
        else {
            res = await obsidian.requestUrl({
                url: this.settings.uploadServer,
                method: "POST",
            });
            data = await res.json;
        }
        if (res.status !== 200) {
            return {
                code: -1,
                msg: data.msg,
                data: "",
            };
        }
        // piclist
        if (data.fullResult) {
            const uploadUrlFullResultList = data.fullResult || [];
            this.settings.uploadedImages = [
                ...(this.settings.uploadedImages || []),
                ...uploadUrlFullResultList,
            ];
            this.plugin.saveSettings();
        }
        return {
            code: 0,
            msg: "success",
            data: typeof data.result == "string" ? data.result : data.result[0],
        };
    }
}
class PicGoCoreUploader {
    settings;
    plugin;
    constructor(settings, plugin) {
        this.settings = settings;
        this.plugin = plugin;
    }
    async uploadFiles(fileList) {
        const length = fileList.length;
        let cli = this.settings.picgoCorePath || "picgo";
        let command = `${cli} upload ${fileList
            .map(item => `"${item}"`)
            .join(" ")}`;
        const res = await this.exec(command);
        const splitList = res.split("\n");
        const splitListLength = splitList.length;
        const data = splitList.splice(splitListLength - 1 - length, length);
        if (res.includes("PicGo ERROR")) {
            console.log(command, res);
            return {
                success: false,
                msg: "失败",
            };
        }
        else {
            return {
                success: true,
                result: data,
            };
        }
        // {success:true,result:[]}
    }
    // PicGo-Core 上传处理
    async uploadFileByClipboard() {
        const res = await this.uploadByClip();
        const splitList = res.split("\n");
        const lastImage = getLastImage(splitList);
        if (lastImage) {
            return {
                code: 0,
                msg: "success",
                data: lastImage,
            };
        }
        else {
            console.log(splitList);
            // new Notice(`"Please check PicGo-Core config"\n${res}`);
            return {
                code: -1,
                msg: `"Please check PicGo-Core config"\n${res}`,
                data: "",
            };
        }
    }
    // PicGo-Core的剪切上传反馈
    async uploadByClip() {
        let command;
        if (this.settings.picgoCorePath) {
            command = `${this.settings.picgoCorePath} upload`;
        }
        else {
            command = `picgo upload`;
        }
        const res = await this.exec(command);
        // const res = await this.spawnChild();
        return res;
    }
    async exec(command) {
        let { stdout } = await require$$0$2.exec(command);
        const res = await streamToString(stdout);
        return res;
    }
    async spawnChild() {
        const { spawn } = require("child_process");
        const child = spawn("picgo", ["upload"], {
            shell: true,
        });
        let data = "";
        for await (const chunk of child.stdout) {
            data += chunk;
        }
        let error = "";
        for await (const chunk of child.stderr) {
            error += chunk;
        }
        const exitCode = await new Promise((resolve, reject) => {
            child.on("close", resolve);
        });
        if (exitCode) {
            throw new Error(`subprocess error exit ${exitCode}, ${error}`);
        }
        return data;
    }
}

class PicGoDeleter {
    plugin;
    constructor(plugin) {
        this.plugin = plugin;
    }
    async deleteImage(configMap) {
        const response = await obsidian.requestUrl({
            url: this.plugin.settings.deleteServer,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                list: configMap,
            }),
        });
        const data = response.json;
        return data;
    }
}

// ![](./dsa/aa.png) local image should has ext, support ![](<./dsa/aa.png>), support ![](image.png "alt")
// ![](https://dasdasda) internet image should not has ext
const REGEX_FILE = /\!\[(.*?)\]\(<(\S+\.\w+)>\)|\!\[(.*?)\]\((\S+\.\w+)(?:\s+"[^"]*")?\)|\!\[(.*?)\]\((https?:\/\/.*?)\)/g;
const REGEX_WIKI_FILE = /\!\[\[(.*?)(\s*?\|.*?)?\]\]/g;
class Helper {
    app;
    constructor(app) {
        this.app = app;
    }
    getFrontmatterValue(key, defaultValue = undefined) {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
            return undefined;
        }
        const path = file.path;
        const cache = this.app.metadataCache.getCache(path);
        let value = defaultValue;
        if (cache?.frontmatter && cache.frontmatter.hasOwnProperty(key)) {
            value = cache.frontmatter[key];
        }
        return value;
    }
    getEditor() {
        const mdView = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        if (mdView) {
            return mdView.editor;
        }
        else {
            return null;
        }
    }
    getValue() {
        const editor = this.getEditor();
        return editor.getValue();
    }
    setValue(value) {
        const editor = this.getEditor();
        const { left, top } = editor.getScrollInfo();
        const position = editor.getCursor();
        editor.setValue(value);
        editor.scrollTo(left, top);
        editor.setCursor(position);
    }
    // get all file urls, include local and internet
    getAllFiles() {
        const editor = this.getEditor();
        let value = editor.getValue();
        return this.getImageLink(value);
    }
    getImageLink(value) {
        const matches = value.matchAll(REGEX_FILE);
        const WikiMatches = value.matchAll(REGEX_WIKI_FILE);
        let fileArray = [];
        for (const match of matches) {
            const source = match[0];
            let name = match[1];
            let path = match[2];
            if (name === undefined) {
                name = match[3];
            }
            if (path === undefined) {
                path = match[4];
            }
            fileArray.push({
                path: path,
                name: name,
                source: source,
            });
        }
        for (const match of WikiMatches) {
            let name = pathBrowserify.parse(match[1]).name;
            const path = match[1];
            const source = match[0];
            if (match[2]) {
                name = `${name}${match[2]}`;
            }
            fileArray.push({
                path: path,
                name: name,
                source: source,
            });
        }
        return fileArray;
    }
    hasBlackDomain(src, blackDomains) {
        if (blackDomains.trim() === "") {
            return false;
        }
        const blackDomainList = blackDomains.split(",").filter(item => item !== "");
        let url = new URL(src);
        const domain = url.hostname;
        return blackDomainList.some(blackDomain => domain.includes(blackDomain));
    }
}

const DEFAULT_SETTINGS = {
    uploadByClipSwitch: true,
    uploader: "PicGo",
    uploadServer: "http://127.0.0.1:36677/upload",
    deleteServer: "http://127.0.0.1:36677/delete",
    imageSizeSuffix: "",
    picgoCorePath: "",
    workOnNetWork: false,
    fixPath: false,
    applyImage: true,
    newWorkBlackDomains: "",
    deleteSource: false,
    autoCleanupRoot: true,
    imageDesc: "origin",
    remoteServerMode: false,
    autoUpdate: true,
};
class SettingTab extends obsidian.PluginSettingTab {
    plugin;
    isCheckingUpdate = false;
    isUpdating = false;
    updateProgress = 0;
    updateResultMessage = "";
    latestVersion = "";
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        let { containerEl } = this;
        const os = getOS();
        containerEl.empty();
        containerEl.createEl("h2", { text: t("Plugin Settings") });
        new obsidian.Setting(containerEl)
            .setName(t("Auto pasted upload"))
            .setDesc(t("If you set this value true, when you paste image, it will be auto uploaded(you should set the picGo server rightly)"))
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.uploadByClipSwitch)
            .onChange(async (value) => {
            this.plugin.settings.uploadByClipSwitch = value;
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName(t("Default uploader"))
            .setDesc(t("Default uploader"))
            .addDropdown(cb => cb
            .addOption("PicGo", "PicGo(app)")
            .addOption("PicGo-Core", "PicGo-Core")
            .setValue(this.plugin.settings.uploader)
            .onChange(async (value) => {
            this.plugin.settings.uploader = value;
            this.display();
            await this.plugin.saveSettings();
        }));
        if (this.plugin.settings.uploader === "PicGo") {
            new obsidian.Setting(containerEl)
                .setName(t("PicGo server"))
                .setDesc(t("PicGo server desc"))
                .addText(text => text
                .setPlaceholder(t("Please input PicGo server"))
                .setValue(this.plugin.settings.uploadServer)
                .onChange(async (key) => {
                this.plugin.settings.uploadServer = key;
                await this.plugin.saveSettings();
            }));
            new obsidian.Setting(containerEl)
                .setName(t("PicGo delete server"))
                .setDesc(t("PicList desc"))
                .addText(text => text
                .setPlaceholder(t("Please input PicGo delete server"))
                .setValue(this.plugin.settings.deleteServer)
                .onChange(async (key) => {
                this.plugin.settings.deleteServer = key;
                await this.plugin.saveSettings();
            }));
        }
        new obsidian.Setting(containerEl)
            .setName(t("Remote server mode"))
            .setDesc(t("Remote server mode desc"))
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.remoteServerMode)
            .onChange(async (value) => {
            this.plugin.settings.remoteServerMode = value;
            if (value) {
                this.plugin.settings.workOnNetWork = false;
            }
            this.display();
            await this.plugin.saveSettings();
        }));
        if (this.plugin.settings.uploader === "PicGo-Core") {
            new obsidian.Setting(containerEl)
                .setName(t("PicGo-Core path"))
                .setDesc(t("Please input PicGo-Core path, default using environment variables"))
                .addText(text => text
                .setPlaceholder("")
                .setValue(this.plugin.settings.picgoCorePath)
                .onChange(async (value) => {
                this.plugin.settings.picgoCorePath = value;
                await this.plugin.saveSettings();
            }));
            if (os !== "Windows") {
                new obsidian.Setting(containerEl)
                    .setName(t("fixPath"))
                    .setDesc(t("fixPathWarning"))
                    .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.fixPath)
                    .onChange(async (value) => {
                    this.plugin.settings.fixPath = value;
                    await this.plugin.saveSettings();
                }));
            }
        }
        // image desc setting
        new obsidian.Setting(containerEl)
            .setName(t("Image desc"))
            .setDesc(t("Image desc"))
            .addDropdown(cb => cb
            .addOption("origin", t("reserve")) // 保留全部
            .addOption("none", t("remove all")) // 移除全部
            .addOption("removeDefault", t("remove default")) // 只移除默认即 image.png
            .setValue(this.plugin.settings.imageDesc)
            .onChange(async (value) => {
            this.plugin.settings.imageDesc = value;
            this.display();
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName(t("Image size suffix"))
            .setDesc(t("Image size suffix Description"))
            .addText(text => text
            .setPlaceholder(t("Please input image size suffix"))
            .setValue(this.plugin.settings.imageSizeSuffix)
            .onChange(async (key) => {
            this.plugin.settings.imageSizeSuffix = key;
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName(t("Work on network"))
            .setDesc(t("Work on network Description"))
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.workOnNetWork)
            .onChange(async (value) => {
            if (this.plugin.settings.remoteServerMode) {
                new obsidian.Notice("Can only work when remote server mode is off.");
                this.plugin.settings.workOnNetWork = false;
            }
            else {
                this.plugin.settings.workOnNetWork = value;
            }
            this.display();
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName(t("Network Domain Black List"))
            .setDesc(t("Network Domain Black List Description"))
            .addTextArea(textArea => textArea
            .setValue(this.plugin.settings.newWorkBlackDomains)
            .onChange(async (value) => {
            this.plugin.settings.newWorkBlackDomains = value;
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName(t("Upload when clipboard has image and text together"))
            .setDesc(t("When you copy, some application like Excel will image and text to clipboard, you can upload or not."))
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.applyImage)
            .onChange(async (value) => {
            this.plugin.settings.applyImage = value;
            this.display();
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName(t("Delete source file after you upload file"))
            .setDesc(t("Delete source file in ob assets after you upload file."))
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.deleteSource)
            .onChange(async (value) => {
            this.plugin.settings.deleteSource = value;
            this.display();
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName("自动清理根目录附件")
            .setDesc("每 30 分钟扫描根目录中的图片和音视频文件，上传后替换链接并删除本地源文件。")
            .addButton(button => button.setButtonText("立即执行").onClick(async () => {
            await this.plugin.cleanupRootAssetsWithNotice();
        }))
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.autoCleanupRoot)
            .onChange(async (value) => {
            this.plugin.settings.autoCleanupRoot = value;
            await this.plugin.saveSettings();
        }));
        this.renderVersionUpdateSection(containerEl);
    }
    renderVersionUpdateSection(containerEl) {
        containerEl.createEl("h2", { text: "版本更新" });
        containerEl.createEl("h3", { text: "file-auto-upload-plugin" });
        containerEl.createDiv({
            cls: "auto-frontmatter-about-version",
            text: `当前版本：${this.plugin.manifest.version}`,
        });
        const actionEl = containerEl.createDiv({ cls: "auto-frontmatter-about-action" });
        const checkButton = actionEl.createEl("button", {
            cls: "mod-cta auto-frontmatter-about-check-btn",
            text: this.isCheckingUpdate ? "检查中..." : "检查更新",
        });
        checkButton.disabled = this.isCheckingUpdate || this.isUpdating;
        checkButton.onclick = async () => {
            this.isCheckingUpdate = true;
            this.updateResultMessage = "";
            this.latestVersion = "";
            this.display();
            const result = await this.plugin.checkForUpdate();
            this.isCheckingUpdate = false;
            if (result.error === "not_found") {
                new obsidian.Notice("未找到远端仓库，请检查网络");
                this.updateResultMessage = "未找到远端仓库，请检查网络";
            }
            else if (result.error) {
                new obsidian.Notice(result.error);
                this.updateResultMessage = result.error;
            }
            else if (result.hasUpdate) {
                this.latestVersion = result.version;
                this.updateResultMessage = `🔄 发现新版本：${result.version}（当前 ${this.plugin.manifest.version}）`;
            }
            else {
                this.updateResultMessage = `✅ 当前已是最新版本（${this.plugin.manifest.version}）`;
            }
            this.display();
        };
        if (this.updateResultMessage) {
            const resultEl = containerEl.createDiv({ cls: "auto-frontmatter-about-result" });
            resultEl.createDiv({ text: this.updateResultMessage });
            if (this.latestVersion) {
                const updateButton = resultEl.createEl("button", {
                    cls: "mod-cta auto-frontmatter-about-update-btn",
                    text: this.isUpdating ? `更新中...（${this.updateProgress}/3）` : "立即更新",
                });
                updateButton.disabled = this.isUpdating;
                updateButton.onclick = async () => {
                    this.isUpdating = true;
                    this.updateProgress = 0;
                    this.display();
                    try {
                        await this.plugin.performUpdate(this.latestVersion, (step, total) => {
                            this.updateProgress = step;
                            this.display();
                        });
                        this.isUpdating = false;
                        this.latestVersion = "";
                        this.updateResultMessage = "";
                    }
                    catch (error) {
                        this.isUpdating = false;
                        new obsidian.Notice(`更新失败：${error}`);
                        this.updateResultMessage = `更新失败：${error}`;
                    }
                    this.display();
                };
            }
        }
        containerEl.createEl("h3", { text: "自动更新", cls: "auto-frontmatter-about-config-title" });
        new obsidian.Setting(containerEl)
            .setName("自动检查更新")
            .setDesc("每 60 分钟自动检查并更新到最新版本。")
            .addToggle(toggle => toggle
            .setValue(this.plugin.settings.autoUpdate)
            .onChange(async (value) => {
            this.plugin.settings.autoUpdate = value;
            await this.plugin.saveSettings();
        }));
    }
}

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/liuyifeng92/obsidian-plugins/main/file-auto-upload-plugin";
class imageAutoUploadPlugin extends obsidian.Plugin {
    settings;
    helper;
    editor;
    picGoUploader;
    picGoDeleter;
    picGoCoreUploader;
    uploader;
    autoUpdateCheckTimer = null;
    pendingAutoReloadTimer = null;
    pendingAutoReloadVersion = "";
    async loadSettings() {
        this.settings = Object.assign(DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
    onunload() {
        this.clearAutoUpdateCheckTimer();
        this.clearPendingAutoReloadTimer();
    }
    async onload() {
        await this.loadSettings();
        this.helper = new Helper(this.app);
        this.picGoUploader = new PicGoUploader(this.settings, this);
        this.picGoDeleter = new PicGoDeleter(this);
        this.picGoCoreUploader = new PicGoCoreUploader(this.settings, this);
        if (this.settings.uploader === "PicGo") {
            this.uploader = this.picGoUploader;
        }
        else if (this.settings.uploader === "PicGo-Core") {
            this.uploader = this.picGoCoreUploader;
            if (this.settings.fixPath) {
                fixPath();
            }
        }
        else {
            new obsidian.Notice("unknown uploader");
        }
        obsidian.addIcon("upload", `<svg t="1636630783429" class="icon" viewBox="0 0 100 100" version="1.1" p-id="4649" xmlns="http://www.w3.org/2000/svg">
      <path d="M 71.638 35.336 L 79.408 35.336 C 83.7 35.336 87.178 38.662 87.178 42.765 L 87.178 84.864 C 87.178 88.969 83.7 92.295 79.408 92.295 L 17.249 92.295 C 12.957 92.295 9.479 88.969 9.479 84.864 L 9.479 42.765 C 9.479 38.662 12.957 35.336 17.249 35.336 L 25.019 35.336 L 25.019 42.765 L 17.249 42.765 L 17.249 84.864 L 79.408 84.864 L 79.408 42.765 L 71.638 42.765 L 71.638 35.336 Z M 49.014 10.179 L 67.326 27.688 L 61.835 32.942 L 52.849 24.352 L 52.849 59.731 L 45.078 59.731 L 45.078 24.455 L 36.194 32.947 L 30.702 27.692 L 49.012 10.181 Z" p-id="4650" fill="#8a8a8a"></path>
    </svg>`);
        this.addSettingTab(new SettingTab(this.app, this));
        this.addCommand({
            id: "Upload all images",
            name: "Upload all images",
            checkCallback: (checking) => {
                let leaf = this.app.workspace.activeLeaf;
                if (leaf) {
                    if (!checking) {
                        this.uploadAllFile();
                    }
                    return true;
                }
                return false;
            },
        });
        this.addCommand({
            id: "Download all images",
            name: "Download all images",
            checkCallback: (checking) => {
                let leaf = this.app.workspace.activeLeaf;
                if (leaf) {
                    if (!checking) {
                        downloadAllImageFiles(this);
                    }
                    return true;
                }
                return false;
            },
        });
        this.setupPasteHandler();
        this.registerMarkdownCodeBlockProcessor("html-preview", (source, el, ctx) => renderHtmlPreview(el, source, this.app));
        this.registerMarkdownPostProcessor(el => {
            scanAndRenderHtmlPreviews(el, this.app);
        });
        this.registerEditorExtension(htmlPreviewExtension(this.app));
        this.registerEvent(this.app.workspace.on("active-leaf-change", () => {
            window.setTimeout(() => {
                const activeView = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
                if (!activeView) {
                    return;
                }
                scanAndRenderHtmlPreviews(activeView.containerEl, this.app);
            }, 200);
        }));
        this.registerFileMenu();
        this.registerInterval(window.setInterval(() => {
            if (this.settings.autoCleanupRoot) {
                this.cleanupRootAssets().catch(error => {
                    console.error("Auto cleanup root assets failed: ", error);
                });
            }
        }, 30 * 60 * 1000));
        this.registerSelection();
        this.scheduleAutoUpdateCheck();
    }
    registerSelection() {
        this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, info) => {
            if (this.app.workspace.getLeavesOfType("markdown").length === 0) {
                return;
            }
            const selection = editor.getSelection();
            if (selection) {
                const markdownRegex = /!\[.*\]\((.*)\)/g;
                const markdownMatch = markdownRegex.exec(selection);
                if (markdownMatch && markdownMatch.length > 1) {
                    const markdownUrl = markdownMatch[1];
                    if (this.settings.uploadedImages.find((item) => item.imgUrl === markdownUrl)) {
                        this.addMenu(menu, markdownUrl, editor);
                    }
                }
            }
        }));
    }
    addMenu = (menu, imgPath, editor) => {
        menu.addItem((item) => item
            .setIcon("trash-2")
            .setTitle(t("Delete image using PicList"))
            .onClick(async () => {
            try {
                const selectedItem = this.settings.uploadedImages.find((item) => item.imgUrl === imgPath);
                if (selectedItem) {
                    const res = await this.picGoDeleter.deleteImage([selectedItem]);
                    if (res.success) {
                        new obsidian.Notice(t("Delete successfully"));
                        const selection = editor.getSelection();
                        if (selection) {
                            editor.replaceSelection("");
                        }
                        this.settings.uploadedImages =
                            this.settings.uploadedImages.filter((item) => item.imgUrl !== imgPath);
                        this.saveSettings();
                    }
                    else {
                        new obsidian.Notice(t("Delete failed"));
                    }
                }
            }
            catch {
                new obsidian.Notice(t("Error, could not delete"));
            }
        }));
    };
    registerFileMenu() {
        this.registerEvent(this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
            if (source === "canvas-menu")
                return false;
            if (!isAssetTypeAnAsset(file.path))
                return false;
            menu.addItem((item) => {
                item
                    .setTitle("Upload")
                    .setIcon("upload")
                    .onClick(() => {
                    if (!(file instanceof obsidian.TFile)) {
                        return false;
                    }
                    this.fileMenuUpload(file);
                });
            });
        }));
    }
    fileMenuUpload(file) {
        let content = this.helper.getValue();
        const basePath = this.app.vault.adapter.getBasePath();
        let imageList = [];
        const fileArray = this.helper.getAllFiles();
        for (const match of fileArray) {
            const imageName = match.name;
            const encodedUri = match.path;
            const fileName = pathBrowserify.basename(decodeURI(encodedUri));
            if (file && file.name === fileName) {
                const abstractImageFile = pathBrowserify.join(basePath, file.path);
                if (isAssetTypeAnAsset(abstractImageFile)) {
                    imageList.push({
                        path: abstractImageFile,
                        name: imageName,
                        source: match.source,
                    });
                }
            }
        }
        if (imageList.length === 0) {
            new obsidian.Notice(t("Can not find image file"));
            return;
        }
        this.uploader.uploadFiles(imageList.map(item => item.path)).then(res => {
            if (res.success) {
                let uploadUrlList = res.result;
                imageList.map(item => {
                    const uploadImage = uploadUrlList.shift();
                    let name = this.handleName(item.name);
                    content = content.replaceAll(item.source, getEmbedMarkdown(item.name, uploadImage, name));
                });
                this.helper.setValue(content);
                if (this.settings.deleteSource) {
                    imageList.map(image => {
                        if (!image.path.startsWith("http")) {
                            require$$0.unlink(image.path, () => { });
                        }
                    });
                }
            }
            else {
                new obsidian.Notice("Upload error");
            }
        });
    }
    filterFile(fileArray) {
        const imageList = [];
        for (const match of fileArray) {
            if (match.path.startsWith("http")) {
                if (this.settings.workOnNetWork) {
                    if (!this.helper.hasBlackDomain(match.path, this.settings.newWorkBlackDomains)) {
                        imageList.push({
                            path: match.path,
                            name: match.name,
                            source: match.source,
                        });
                    }
                }
            }
            else {
                imageList.push({
                    path: match.path,
                    name: match.name,
                    source: match.source,
                });
            }
        }
        return imageList;
    }
    getFile(fileName, fileMap) {
        if (!fileMap) {
            fileMap = arrayToObject(this.app.vault.getFiles(), "name");
        }
        return fileMap[fileName];
    }
    async cleanupRootAssets() {
        const result = {
            scanned: 0,
            uploaded: 0,
            replaced: 0,
            deleted: 0,
            failed: [],
        };
        const basePath = this.app.vault.adapter.getBasePath();
        const rootAssets = this.app.vault
            .getFiles()
            .filter(file => file.path === file.name &&
            (isAssetTypeAnAsset(file.path) || isHtmlFile(file.path)));
        result.scanned = rootAssets.length;
        for (const file of rootAssets) {
            try {
                if (isHtmlFile(file.path)) {
                    const targetPath = this.getUniqueHtmlEmbedPath(file.name);
                    const previewCode = wrapHtmlPreviewPath(targetPath);
                    const replaced = await this.replaceHtmlFileReferencesWithCode(file, previewCode);
                    if (replaced === 0) {
                        result.failed.push(`${file.name}: 没有笔记引用该 HTML 文件，已保留`);
                        continue;
                    }
                    await this.ensureHtmlEmbedsFolder();
                    await this.app.vault.adapter.rename(file.path, targetPath);
                    result.replaced += replaced;
                    result.deleted++;
                    continue;
                }
                const uploadResult = await this.uploader.uploadFiles([
                    pathBrowserify.join(basePath, file.path),
                ]);
                if (!uploadResult.success ||
                    !uploadResult.result ||
                    uploadResult.result.length === 0) {
                    result.failed.push(`${file.name}: 上传失败 ${uploadResult.msg || ""}`.trim());
                    continue;
                }
                result.uploaded++;
                const uploadUrl = this.getUploadUrl(uploadResult.result[0]);
                console.log("Auto cleanup root asset uploaded URL: ", uploadUrl);
                if (!uploadUrl) {
                    result.failed.push(`${file.name}: 上传成功但没有拿到远程 URL`);
                    continue;
                }
                const replaced = await this.replaceRootAssetLinks(file, uploadUrl);
                if (replaced === 0) {
                    result.failed.push(`${file.name}: 上传成功，但没有在笔记文件中找到引用，已保留本地文件`);
                    continue;
                }
                result.replaced += replaced;
                await this.app.vault.delete(file);
                result.deleted++;
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                result.failed.push(`${file.name}: ${reason}`);
            }
        }
        return result;
    }
    async cleanupRootAssetsWithNotice() {
        const result = await this.cleanupRootAssets();
        if (result.scanned === 0) {
            new obsidian.Notice("根目录清理：没有找到需要上传的图片或音视频文件。");
            return;
        }
        const summary = `根目录清理完成：扫描 ${result.scanned} 个，上传 ${result.uploaded} 个，替换 ${result.replaced} 处，删除 ${result.deleted} 个。`;
        if (result.failed.length === 0) {
            new obsidian.Notice(summary);
            return;
        }
        new obsidian.Notice(`${summary}\n未完成：${result.failed.slice(0, 3).join("；")}`);
    }
    getUploadUrl(result) {
        if (typeof result === "string") {
            return result;
        }
        if (result && typeof result === "object") {
            return result.imgUrl || result.url || result.path || "";
        }
        return "";
    }
    async replaceRootAssetLinks(file, url) {
        let replaced = 0;
        for (const noteFile of this.app.vault.getFiles().filter(this.isReferenceFile)) {
            const content = await this.app.vault.read(noteFile);
            const result = noteFile.extension === "canvas"
                ? this.replaceCanvasAssetLinks(content, file, url)
                : this.replaceAssetLinks(content, file, url);
            if (result.content !== content) {
                await this.app.vault.modify(noteFile, result.content);
                replaced += result.replaced;
            }
        }
        return replaced;
    }
    isReferenceFile(file) {
        return ["md", "canvas", "html"].includes(file.extension);
    }
    isSameRootAsset(target, file) {
        let path = target.trim();
        if (path.startsWith("<") && path.endsWith(">")) {
            path = path.slice(1, -1);
        }
        if ((path.startsWith('"') && path.endsWith('"')) ||
            (path.startsWith("'") && path.endsWith("'"))) {
            path = path.slice(1, -1);
        }
        path = path.split("#")[0].split("?")[0];
        try {
            path = decodeURI(path);
        }
        catch {
            return false;
        }
        if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
            return false;
        }
        const normalizedPath = obsidian.normalizePath(path);
        return normalizedPath === file.path || pathBrowserify.basename(normalizedPath) === file.name;
    }
    replaceCanvasAssetLinks(content, file, url) {
        let data;
        try {
            data = JSON.parse(content);
        }
        catch {
            return {
                content,
                replaced: 0,
            };
        }
        if (!Array.isArray(data.nodes)) {
            return {
                content,
                replaced: 0,
            };
        }
        let replaced = 0;
        data.nodes.forEach((node) => {
            if (node &&
                node.type === "file" &&
                typeof node.file === "string" &&
                this.isSameRootAsset(node.file, file)) {
                node.type = "link";
                node.url = url;
                delete node.file;
                replaced++;
            }
        });
        return {
            content: replaced > 0 ? JSON.stringify(data, null, "\t") : content,
            replaced,
        };
    }
    replaceAssetLinks(content, file, url) {
        const escapeRegExp = (value) => {
            return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        };
        const wikilinkRegex = /!\[\[([^\]]+)\]\]/g;
        const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let replaced = 0;
        const replacements = [];
        const newContent = content
            .replace(wikilinkRegex, (source, target) => {
            const path = target.split("|")[0];
            const alt = target.split("|")[1] || file.name;
            if (!this.isSameRootAsset(path, file)) {
                return source;
            }
            replaced++;
            replacements.push(getEmbedMarkdown(file.name, url, alt));
            return `\u0000ROOT_ASSET_${replacements.length - 1}\u0000`;
        })
            .replace(markdownImageRegex, (source, alt, target) => {
            if (!this.isSameRootAsset(target, file)) {
                return source;
            }
            replaced++;
            replacements.push(getEmbedMarkdown(file.name, url, alt));
            return `\u0000ROOT_ASSET_${replacements.length - 1}\u0000`;
        })
            .replace(new RegExp(escapeRegExp(file.name), "g"), (source, offset, fullContent) => {
            if (!isAssetTypeAnAsset(file.name)) {
                return source;
            }
            const before = offset > 0 ? fullContent[offset - 1] : "";
            const after = fullContent[offset + source.length] || "";
            if (/[\p{L}\p{N}_\[\(\/\\.\-]/u.test(before)) {
                return source;
            }
            if (/[\p{L}\p{N}_\]\)\|\/\\.\-]/u.test(after)) {
                return source;
            }
            replaced++;
            return getEmbedMarkdown(file.name, url);
        })
            .replace(/\u0000ROOT_ASSET_(\d+)\u0000/g, (source, index) => {
            return replacements[Number(index)] || source;
        });
        return {
            content: newContent,
            replaced,
        };
    }
    replaceHtmlReferences(content, file, previewCode) {
        const wikilinkRegex = /!\[\[([^\]]+)\]\]/g;
        const markdownLinkRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let replaced = 0;
        const replacements = [];
        const newContent = content
            .replace(wikilinkRegex, (match, target) => {
            const path = target.split("|")[0];
            if (!this.isSameRootAsset(path, file)) {
                return match;
            }
            replaced++;
            replacements.push(previewCode);
            return `\u0000HTML_ASSET_${replacements.length - 1}\u0000`;
        })
            .replace(markdownLinkRegex, (match, alt, target) => {
            if (!this.isSameRootAsset(target, file)) {
                return match;
            }
            replaced++;
            replacements.push(previewCode);
            return `\u0000HTML_ASSET_${replacements.length - 1}\u0000`;
        })
            .replace(/\u0000HTML_ASSET_(\d+)\u0000/g, (match, index) => {
            return replacements[Number(index)] || match;
        });
        return {
            content: newContent,
            replaced,
        };
    }
    async replaceHtmlFileReferences(file, source) {
        const previewCode = wrapHtmlPreviewCode(source);
        return this.replaceHtmlFileReferencesWithCode(file, previewCode);
    }
    async replaceHtmlFileReferencesWithCode(file, previewCode) {
        let replaced = 0;
        for (const noteFile of this.app.vault.getFiles().filter(this.isReferenceFile)) {
            if (noteFile.extension === "canvas" || noteFile.path === file.path) {
                continue;
            }
            const content = await this.app.vault.read(noteFile);
            const result = this.replaceHtmlReferences(content, file, previewCode);
            if (result.content !== content) {
                await this.app.vault.modify(noteFile, result.content);
                replaced += result.replaced;
            }
        }
        return replaced;
    }
    async ensureHtmlEmbedsFolder() {
        const folderPath = ".html-embeds";
        if (!(await this.app.vault.adapter.exists(folderPath))) {
            await this.app.vault.adapter.mkdir(folderPath);
        }
    }
    getUniqueHtmlEmbedPath(fileName) {
        const basePath = ".html-embeds/";
        let targetPath = `${basePath}${fileName}`;
        if (!this.app.vault.getAbstractFileByPath(targetPath)) {
            return targetPath;
        }
        const timestamp = Date.now();
        const extIndex = fileName.lastIndexOf(".");
        const baseName = extIndex > 0 ? fileName.slice(0, extIndex) : fileName;
        const ext = extIndex > 0 ? fileName.slice(extIndex) : "";
        targetPath = `${basePath}${baseName}-${timestamp}${ext}`;
        return targetPath;
    }
    getHtmlFileSourcePath(file) {
        if (file.path) {
            return file.path;
        }
        try {
            const { webUtils } = window.require("electron");
            return webUtils.getPathForFile(file);
        }
        catch {
            return null;
        }
    }
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }
    async moveHtmlFileToEmbeds(file) {
        await this.ensureHtmlEmbedsFolder();
        const targetPath = this.getUniqueHtmlEmbedPath(file.name);
        const sourcePath = this.getHtmlFileSourcePath(file);
        if (sourcePath) {
            const basePath = obsidian.normalizePath(this.app.vault.adapter.getBasePath());
            const normalizedSource = obsidian.normalizePath(sourcePath);
            if (normalizedSource.startsWith(basePath + "/") &&
                normalizedSource !== obsidian.normalizePath(pathBrowserify.join(basePath, targetPath))) {
                const relativeSource = normalizedSource.slice(basePath.length + 1);
                await this.app.vault.adapter.rename(relativeSource, targetPath);
                return targetPath;
            }
        }
        const content = await this.readFileAsText(file);
        await this.app.vault.adapter.write(targetPath, content);
        return targetPath;
    }
    // uploda all file
    uploadAllFile() {
        let content = this.helper.getValue();
        const basePath = this.app.vault.adapter.getBasePath();
        const activeFile = this.app.workspace.getActiveFile();
        const fileMap = arrayToObject(this.app.vault.getFiles(), "name");
        const filePathMap = arrayToObject(this.app.vault.getFiles(), "path");
        let imageList = [];
        const fileArray = this.filterFile(this.helper.getAllFiles());
        for (const match of fileArray) {
            const imageName = match.name;
            const encodedUri = match.path;
            if (encodedUri.startsWith("http")) {
                imageList.push({
                    path: match.path,
                    name: imageName,
                    source: match.source,
                });
            }
            else {
                const fileName = pathBrowserify.basename(decodeURI(encodedUri));
                let file;
                // 绝对路径
                if (filePathMap[decodeURI(encodedUri)]) {
                    file = filePathMap[decodeURI(encodedUri)];
                }
                // 相对路径
                if ((!file && decodeURI(encodedUri).startsWith("./")) ||
                    decodeURI(encodedUri).startsWith("../")) {
                    const filePath = pathBrowserify.resolve(pathBrowserify.join(basePath, pathBrowserify.dirname(activeFile.path)), decodeURI(encodedUri));
                    if (require$$0.existsSync(filePath)) {
                        const path = obsidian.normalizePath(pathBrowserify.relative(obsidian.normalizePath(basePath), obsidian.normalizePath(pathBrowserify.resolve(pathBrowserify.join(basePath, pathBrowserify.dirname(activeFile.path)), decodeURI(encodedUri)))));
                        file = filePathMap[path];
                    }
                }
                // 尽可能短路径
                if (!file) {
                    file = this.getFile(fileName, fileMap);
                }
                if (file) {
                    const abstractImageFile = pathBrowserify.join(basePath, file.path);
                    if (isAssetTypeAnAsset(abstractImageFile)) {
                        imageList.push({
                            path: abstractImageFile,
                            name: imageName,
                            source: match.source,
                        });
                    }
                }
            }
        }
        if (imageList.length === 0) {
            new obsidian.Notice(t("Can not find image file"));
            return;
        }
        else {
            new obsidian.Notice(`共找到${imageList.length}个图像文件，开始上传`);
        }
        this.uploader.uploadFiles(imageList.map(item => item.path)).then(res => {
            if (res.success) {
                let uploadUrlList = res.result;
                if (imageList.length !== uploadUrlList.length) {
                    new obsidian.Notice(t("Warning: upload files is different of reciver files from api"));
                }
                imageList.map(item => {
                    const uploadImage = uploadUrlList.shift();
                    let name = this.handleName(item.name);
                    content = content.replaceAll(item.source, getEmbedMarkdown(item.name, uploadImage, name));
                });
                const currentFile = this.app.workspace.getActiveFile();
                if (activeFile.path !== currentFile.path) {
                    new obsidian.Notice(t("File has been changedd, upload failure"));
                    return;
                }
                this.helper.setValue(content);
                if (this.settings.deleteSource) {
                    imageList.map(image => {
                        if (!image.path.startsWith("http")) {
                            require$$0.unlink(image.path, () => { });
                        }
                    });
                }
            }
            else {
                new obsidian.Notice("Upload error");
            }
        });
    }
    setupPasteHandler() {
        this.registerEvent(this.app.workspace.on("editor-paste", (evt, editor, markdownView) => {
            try {
                const allowUpload = this.helper.getFrontmatterValue("image-auto-upload", this.settings.uploadByClipSwitch);
                let files = evt.clipboardData.files;
                console.log("[file-auto-upload] paste event fired, files:", files?.length);
                console.log("[file-auto-upload] file type:", files?.[0]?.type, "name:", files?.[0]?.name);
                if (!allowUpload) {
                    return;
                }
                const htmlFile = Array.from(files).find(file => isHtmlFile(file.name));
                if (htmlFile) {
                    console.log("[file-auto-upload] detected HTML file, entering html-preview flow");
                    evt.preventDefault();
                    (async () => {
                        try {
                            await this.insertHtmlPreviewCodeBlock(editor, htmlFile);
                        }
                        catch (error) {
                            console.error("Failed to insert HTML file: ", error);
                        }
                    })();
                    return;
                }
                // 剪贴板内容有md格式的图片时
                if (this.settings.workOnNetWork) {
                    const clipboardValue = evt.clipboardData.getData("text/plain");
                    const imageList = this.helper
                        .getImageLink(clipboardValue)
                        .filter(image => image.path.startsWith("http"))
                        .filter(image => !this.helper.hasBlackDomain(image.path, this.settings.newWorkBlackDomains));
                    if (imageList.length !== 0) {
                        this.uploader
                            .uploadFiles(imageList.map(item => item.path))
                            .then(res => {
                            let value = this.helper.getValue();
                            if (res.success) {
                                let uploadUrlList = res.result;
                                imageList.map(item => {
                                    const uploadImage = uploadUrlList.shift();
                                    let name = this.handleName(item.name);
                                    value = value.replaceAll(item.source, getEmbedMarkdown(item.name, uploadImage, name));
                                });
                                this.helper.setValue(value);
                            }
                            else {
                                new obsidian.Notice("Upload error");
                            }
                        });
                    }
                }
                // 剪贴板中是图片时进行上传
                if (this.canUpload(evt.clipboardData)) {
                    this.uploadFileAndEmbedImgurImage(editor, async (editor, pasteId) => {
                        let res;
                        res = await this.uploader.uploadFileByClipboard(evt.clipboardData.files);
                        if (res.code !== 0) {
                            this.handleFailedUpload(editor, pasteId, res.msg);
                            return;
                        }
                        const url = res.data;
                        return url;
                    }, evt.clipboardData).catch();
                    evt.preventDefault();
                }
            }
            catch (error) {
                console.error("[file-auto-upload] paste handler error:", error);
            }
            finally {
                // 重置所有状态 flag
            }
        }));
        this.registerEvent(this.app.workspace.on("editor-drop", async (evt, editor, markdownView) => {
            // when ctrl key is pressed, do not upload image, because it is used to set local file
            if (evt.ctrlKey) {
                return;
            }
            const allowUpload = this.helper.getFrontmatterValue("image-auto-upload", this.settings.uploadByClipSwitch);
            let files = evt.dataTransfer.files;
            if (!allowUpload) {
                return;
            }
            const htmlFile = Array.from(files).find(file => isHtmlFile(file.name));
            if (htmlFile) {
                evt.preventDefault();
                try {
                    await this.insertHtmlPreviewCodeBlock(editor, htmlFile);
                }
                catch (error) {
                    console.error("Failed to insert HTML file: ", error);
                }
                return;
            }
            if (files.length !== 0 &&
                (files[0].type.startsWith("image") ||
                    files[0].type.startsWith("video") ||
                    files[0].type.startsWith("audio"))) {
                let sendFiles = [];
                let files = evt.dataTransfer.files;
                Array.from(files).forEach((item, index) => {
                    if (item.path) {
                        sendFiles.push(item.path);
                    }
                    else {
                        const { webUtils } = require("electron");
                        const path = webUtils.getPathForFile(item);
                        sendFiles.push(path);
                    }
                });
                evt.preventDefault();
                const data = await this.uploader.uploadFiles(sendFiles);
                if (data.success) {
                    data.result.map((value, index) => {
                        let pasteId = (Math.random() + 1).toString(36).substr(2, 5);
                        this.insertTemporaryText(editor, pasteId);
                        this.embedMarkDownImage(editor, pasteId, value, files[index].name);
                    });
                }
                else {
                    new obsidian.Notice("Upload error");
                }
            }
        }));
    }
    async insertHtmlPreviewCodeBlock(editor, file) {
        const targetPath = await this.moveHtmlFileToEmbeds(file);
        editor.replaceSelection(wrapHtmlPreviewPath(targetPath));
        return targetPath;
    }
    canUpload(clipboardData) {
        this.settings.applyImage;
        const files = clipboardData.files;
        const text = clipboardData.getData("text");
        const hasImageFile = files.length !== 0 &&
            (files[0].type.startsWith("image") ||
                files[0].type.startsWith("video") ||
                files[0].type.startsWith("audio"));
        if (hasImageFile) {
            if (!!text) {
                return this.settings.applyImage;
            }
            else {
                return true;
            }
        }
        else {
            return false;
        }
    }
    async uploadFileAndEmbedImgurImage(editor, callback, clipboardData) {
        let pasteId = (Math.random() + 1).toString(36).substr(2, 5);
        this.insertTemporaryText(editor, pasteId);
        const name = clipboardData.files[0].name;
        try {
            const url = await callback(editor, pasteId);
            this.embedMarkDownImage(editor, pasteId, url, name);
        }
        catch (e) {
            this.handleFailedUpload(editor, pasteId, e);
        }
    }
    insertTemporaryText(editor, pasteId) {
        let progressText = imageAutoUploadPlugin.progressTextFor(pasteId);
        editor.replaceSelection(progressText + "\n");
    }
    static progressTextFor(id) {
        return `![Uploading file...${id}]()`;
    }
    embedMarkDownImage(editor, pasteId, imageUrl, name = "") {
        let progressText = imageAutoUploadPlugin.progressTextFor(pasteId);
        const imageName = this.handleName(name);
        let markDownImage = getEmbedMarkdown(name, imageUrl, imageName);
        imageAutoUploadPlugin.replaceFirstOccurrence(editor, progressText, markDownImage);
    }
    handleFailedUpload(editor, pasteId, reason) {
        new obsidian.Notice(reason);
        console.error("Failed request: ", reason);
        let progressText = imageAutoUploadPlugin.progressTextFor(pasteId);
        imageAutoUploadPlugin.replaceFirstOccurrence(editor, progressText, "⚠️upload failed, check dev console");
    }
    handleName(name) {
        const imageSizeSuffix = this.settings.imageSizeSuffix || "";
        if (this.settings.imageDesc === "origin") {
            return `${name}${imageSizeSuffix}`;
        }
        else if (this.settings.imageDesc === "none") {
            return "";
        }
        else if (this.settings.imageDesc === "removeDefault") {
            if (name === "image.png") {
                return "";
            }
            else {
                return `${name}${imageSizeSuffix}`;
            }
        }
        else {
            return `${name}${imageSizeSuffix}`;
        }
    }
    static replaceFirstOccurrence(editor, target, replacement) {
        let lines = editor.getValue().split("\n");
        for (let i = 0; i < lines.length; i++) {
            let ch = lines[i].indexOf(target);
            if (ch != -1) {
                let from = { line: i, ch: ch };
                let to = { line: i, ch: ch + target.length };
                editor.replaceRange(replacement, from, to);
                break;
            }
        }
    }
    async checkForUpdate() {
        try {
            const response = await fetch(`${GITHUB_RAW_BASE}/manifest.json`);
            if (response.status === 404) {
                return { hasUpdate: false, version: "", error: "not_found" };
            }
            if (!response.ok) {
                return { hasUpdate: false, version: "", error: `请求失败：${response.status}` };
            }
            const remoteManifest = (await response.json());
            const remoteVersion = remoteManifest.version ?? "";
            if (!remoteVersion) {
                return { hasUpdate: false, version: "", error: "远端版本号无效" };
            }
            const currentVersion = this.manifest.version;
            const hasUpdate = this.compareVersions(remoteVersion, currentVersion) > 0;
            return { hasUpdate, version: remoteVersion };
        }
        catch (error) {
            return { hasUpdate: false, version: "", error: String(error) };
        }
    }
    async performUpdate(version, onProgress) {
        await this.downloadAndWriteUpdateFiles(version, onProgress);
        await this.reloadPlugin(version, false);
    }
    async downloadAndWriteUpdateFiles(version, onProgress) {
        const files = ["main.js", "manifest.json", "styles.css"];
        const contents = {};
        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            const response = await fetch(`${GITHUB_RAW_BASE}/${file}`);
            if (!response.ok) {
                throw new Error(`下载 ${file} 失败：${response.status}`);
            }
            contents[file] = await response.text();
            onProgress?.(index + 1, files.length);
        }
        const pluginDir = this.manifest.dir;
        if (!pluginDir) {
            throw new Error("无法获取插件目录");
        }
        await this.app.vault.adapter.write(`${pluginDir}/main.js`, contents["main.js"]);
        await this.app.vault.adapter.write(`${pluginDir}/manifest.json`, contents["manifest.json"]);
        await this.app.vault.adapter.write(`${pluginDir}/styles.css`, contents["styles.css"]);
    }
    async reloadPlugin(version, auto = false) {
        const pluginId = this.manifest.id;
        const app = this.app;
        if (auto) {
            // @ts-ignore — 内部 API
            const setting = app.setting;
            if (setting && setting.activeTab?.id === pluginId) {
                this.pendingAutoReloadVersion = version;
                this.watchPendingAutoReload();
                return;
            }
        }
        new obsidian.Notice(auto ? `发现新版本（${version}），正在自动更新...` : `更新完成（${version}），正在重载插件...`);
        window.setTimeout(async () => {
            try {
                // @ts-ignore — 内部 API
                await app.plugins.unloadPlugin(pluginId);
                // @ts-ignore — 内部 API
                delete app.plugins.manifests[pluginId];
                await new Promise((resolve) => window.setTimeout(resolve, 300));
                // @ts-ignore — 内部 API
                await app.plugins.loadManifests();
                await new Promise((resolve) => window.setTimeout(resolve, 300));
                // @ts-ignore — 内部 API
                await app.plugins.loadPlugin(pluginId);
                // @ts-ignore — 内部 API
                await app.plugins.enablePlugin(pluginId);
                await new Promise((resolve) => window.setTimeout(resolve, 500));
                // @ts-ignore — 内部 API
                app.setting.open();
                // @ts-ignore — 内部 API
                app.setting.openTabById(pluginId);
                new obsidian.Notice(auto ? `插件已自动更新到 ${version}` : `插件已重载到 ${version}`);
            }
            catch (e) {
                console.error("[file-auto-upload-plugin] 重载失败:", e);
                new obsidian.Notice("自动重载失败，请点击已安装插件页的「重新加载插件」按钮");
            }
        }, 100);
    }
    watchPendingAutoReload() {
        this.clearPendingAutoReloadTimer();
        this.pendingAutoReloadTimer = window.setInterval(() => {
            const pluginId = this.manifest.id;
            // @ts-ignore — 内部 API
            const setting = this.app.setting;
            if (!setting || setting.activeTab?.id !== pluginId) {
                this.clearPendingAutoReloadTimer();
                const version = this.pendingAutoReloadVersion;
                this.pendingAutoReloadVersion = "";
                if (version) {
                    void this.reloadPlugin(version, true);
                }
            }
        }, 1000);
    }
    clearAutoUpdateCheckTimer() {
        if (this.autoUpdateCheckTimer !== null) {
            window.clearTimeout(this.autoUpdateCheckTimer);
            this.autoUpdateCheckTimer = null;
        }
    }
    clearPendingAutoReloadTimer() {
        if (this.pendingAutoReloadTimer !== null) {
            window.clearInterval(this.pendingAutoReloadTimer);
            this.pendingAutoReloadTimer = null;
        }
    }
    scheduleAutoUpdateCheck() {
        this.clearAutoUpdateCheckTimer();
        this.autoUpdateCheckTimer = window.setTimeout(() => {
            void this.runAutoUpdateCheck();
            this.registerInterval(window.setInterval(() => {
                void this.runAutoUpdateCheck();
            }, 60 * 60 * 1000));
        }, 30 * 1000);
    }
    async runAutoUpdateCheck() {
        if (!this.settings.autoUpdate) {
            return;
        }
        const result = await this.checkForUpdate();
        if (result.error || !result.hasUpdate) {
            return;
        }
        void this.performAutoUpdate(result.version);
    }
    async performAutoUpdate(version) {
        try {
            new obsidian.Notice(`发现新版本 ${version}，正在自动更新...`);
            await this.downloadAndWriteUpdateFiles(version);
            await this.reloadPlugin(version, true);
        }
        catch (error) {
            console.error("[file-auto-upload-plugin] 自动更新失败:", error);
        }
    }
    compareVersions(v1, v2) {
        const parseVersion = (version) => {
            return version
                .replace(/^v/, "")
                .split(".")
                .map((part) => {
                const match = /^\d+/.exec(part);
                return match ? parseInt(match[0], 10) : 0;
            });
        };
        const parts1 = parseVersion(v1);
        const parts2 = parseVersion(v2);
        const maxLength = Math.max(parts1.length, parts2.length);
        for (let index = 0; index < maxLength; index++) {
            const a = parts1[index] ?? 0;
            const b = parts2[index] ?? 0;
            if (a > b)
                return 1;
            if (a < b)
                return -1;
        }
        return 0;
    }
}

module.exports = imageAutoUploadPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzLy5wbnBtL3BhdGgtYnJvd3NlcmlmeUAxLjAuMS9ub2RlX21vZHVsZXMvcGF0aC1icm93c2VyaWZ5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2lzZXhlQDIuMC4wL25vZGVfbW9kdWxlcy9pc2V4ZS93aW5kb3dzLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2lzZXhlQDIuMC4wL25vZGVfbW9kdWxlcy9pc2V4ZS9tb2RlLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2lzZXhlQDIuMC4wL25vZGVfbW9kdWxlcy9pc2V4ZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS93aGljaEAyLjAuMi9ub2RlX21vZHVsZXMvd2hpY2gvd2hpY2guanMiLCJub2RlX21vZHVsZXMvLnBucG0vcGF0aC1rZXlAMy4xLjEvbm9kZV9tb2R1bGVzL3BhdGgta2V5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2Nyb3NzLXNwYXduQDcuMC4zL25vZGVfbW9kdWxlcy9jcm9zcy1zcGF3bi9saWIvdXRpbC9yZXNvbHZlQ29tbWFuZC5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9jcm9zcy1zcGF3bkA3LjAuMy9ub2RlX21vZHVsZXMvY3Jvc3Mtc3Bhd24vbGliL3V0aWwvZXNjYXBlLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3NoZWJhbmctcmVnZXhAMy4wLjAvbm9kZV9tb2R1bGVzL3NoZWJhbmctcmVnZXgvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vc2hlYmFuZy1jb21tYW5kQDIuMC4wL25vZGVfbW9kdWxlcy9zaGViYW5nLWNvbW1hbmQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vY3Jvc3Mtc3Bhd25ANy4wLjMvbm9kZV9tb2R1bGVzL2Nyb3NzLXNwYXduL2xpYi91dGlsL3JlYWRTaGViYW5nLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2Nyb3NzLXNwYXduQDcuMC4zL25vZGVfbW9kdWxlcy9jcm9zcy1zcGF3bi9saWIvcGFyc2UuanMiLCJub2RlX21vZHVsZXMvLnBucG0vY3Jvc3Mtc3Bhd25ANy4wLjMvbm9kZV9tb2R1bGVzL2Nyb3NzLXNwYXduL2xpYi9lbm9lbnQuanMiLCJub2RlX21vZHVsZXMvLnBucG0vY3Jvc3Mtc3Bhd25ANy4wLjMvbm9kZV9tb2R1bGVzL2Nyb3NzLXNwYXduL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3N0cmlwLWZpbmFsLW5ld2xpbmVAMi4wLjAvbm9kZV9tb2R1bGVzL3N0cmlwLWZpbmFsLW5ld2xpbmUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vbnBtLXJ1bi1wYXRoQDQuMC4xL25vZGVfbW9kdWxlcy9ucG0tcnVuLXBhdGgvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vbWltaWMtZm5AMi4xLjAvbm9kZV9tb2R1bGVzL21pbWljLWZuL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL29uZXRpbWVANS4xLjIvbm9kZV9tb2R1bGVzL29uZXRpbWUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vaHVtYW4tc2lnbmFsc0AyLjEuMC9ub2RlX21vZHVsZXMvaHVtYW4tc2lnbmFscy9idWlsZC9zcmMvY29yZS5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9odW1hbi1zaWduYWxzQDIuMS4wL25vZGVfbW9kdWxlcy9odW1hbi1zaWduYWxzL2J1aWxkL3NyYy9yZWFsdGltZS5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9odW1hbi1zaWduYWxzQDIuMS4wL25vZGVfbW9kdWxlcy9odW1hbi1zaWduYWxzL2J1aWxkL3NyYy9zaWduYWxzLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2h1bWFuLXNpZ25hbHNAMi4xLjAvbm9kZV9tb2R1bGVzL2h1bWFuLXNpZ25hbHMvYnVpbGQvc3JjL21haW4uanMiLCJub2RlX21vZHVsZXMvLnBucG0vZXhlY2FANS4xLjEvbm9kZV9tb2R1bGVzL2V4ZWNhL2xpYi9lcnJvci5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9leGVjYUA1LjEuMS9ub2RlX21vZHVsZXMvZXhlY2EvbGliL3N0ZGlvLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3NpZ25hbC1leGl0QDMuMC43L25vZGVfbW9kdWxlcy9zaWduYWwtZXhpdC9zaWduYWxzLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3NpZ25hbC1leGl0QDMuMC43L25vZGVfbW9kdWxlcy9zaWduYWwtZXhpdC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9leGVjYUA1LjEuMS9ub2RlX21vZHVsZXMvZXhlY2EvbGliL2tpbGwuanMiLCJub2RlX21vZHVsZXMvLnBucG0vaXMtc3RyZWFtQDIuMC4xL25vZGVfbW9kdWxlcy9pcy1zdHJlYW0vaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vZ2V0LXN0cmVhbUA2LjAuMS9ub2RlX21vZHVsZXMvZ2V0LXN0cmVhbS9idWZmZXItc3RyZWFtLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2dldC1zdHJlYW1ANi4wLjEvbm9kZV9tb2R1bGVzL2dldC1zdHJlYW0vaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vbWVyZ2Utc3RyZWFtQDIuMC4wL25vZGVfbW9kdWxlcy9tZXJnZS1zdHJlYW0vaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vZXhlY2FANS4xLjEvbm9kZV9tb2R1bGVzL2V4ZWNhL2xpYi9zdHJlYW0uanMiLCJub2RlX21vZHVsZXMvLnBucG0vZXhlY2FANS4xLjEvbm9kZV9tb2R1bGVzL2V4ZWNhL2xpYi9wcm9taXNlLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2V4ZWNhQDUuMS4xL25vZGVfbW9kdWxlcy9leGVjYS9saWIvY29tbWFuZC5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9leGVjYUA1LjEuMS9ub2RlX21vZHVsZXMvZXhlY2EvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vYW5zaS1yZWdleEA2LjEuMC9ub2RlX21vZHVsZXMvYW5zaS1yZWdleC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9zdHJpcC1hbnNpQDcuMS4wL25vZGVfbW9kdWxlcy9zdHJpcC1hbnNpL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2RlZmF1bHQtc2hlbGxAMi4yLjAvbm9kZV9tb2R1bGVzL2RlZmF1bHQtc2hlbGwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vc2hlbGwtZW52QDQuMC4xL25vZGVfbW9kdWxlcy9zaGVsbC1lbnYvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vc2hlbGwtcGF0aEAzLjAuMC9ub2RlX21vZHVsZXMvc2hlbGwtcGF0aC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9maXgtcGF0aEA0LjAuMC9ub2RlX21vZHVsZXMvZml4LXBhdGgvaW5kZXguanMiLCJzcmMvdXRpbHMudHMiLCJzcmMvaHRtbFByZXZpZXcudHMiLCJzcmMvaHRtbFByZXZpZXdFZGl0b3IudHMiLCJub2RlX21vZHVsZXMvLnBucG0vdG9rZW4tdHlwZXNANS4wLjEvbm9kZV9tb2R1bGVzL3Rva2VuLXR5cGVzL2xpYi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9wZWVrLXJlYWRhYmxlQDUuMy4xL25vZGVfbW9kdWxlcy9wZWVrLXJlYWRhYmxlL2xpYi9FbmRPZlN0cmVhbUVycm9yLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3BlZWstcmVhZGFibGVANS4zLjEvbm9kZV9tb2R1bGVzL3BlZWstcmVhZGFibGUvbGliL0RlZmVycmVkLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3BlZWstcmVhZGFibGVANS4zLjEvbm9kZV9tb2R1bGVzL3BlZWstcmVhZGFibGUvbGliL0Fic3RyYWN0U3RyZWFtUmVhZGVyLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3BlZWstcmVhZGFibGVANS4zLjEvbm9kZV9tb2R1bGVzL3BlZWstcmVhZGFibGUvbGliL1N0cmVhbVJlYWRlci5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9zdHJ0b2szQDcuMS4xL25vZGVfbW9kdWxlcy9zdHJ0b2szL2xpYi9BYnN0cmFjdFRva2VuaXplci5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9zdHJ0b2szQDcuMS4xL25vZGVfbW9kdWxlcy9zdHJ0b2szL2xpYi9SZWFkU3RyZWFtVG9rZW5pemVyLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3N0cnRvazNANy4xLjEvbm9kZV9tb2R1bGVzL3N0cnRvazMvbGliL0J1ZmZlclRva2VuaXplci5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9zdHJ0b2szQDcuMS4xL25vZGVfbW9kdWxlcy9zdHJ0b2szL2xpYi9jb3JlLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2ZpbGUtdHlwZUAxOC43LjAvbm9kZV9tb2R1bGVzL2ZpbGUtdHlwZS91dGlsLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2ZpbGUtdHlwZUAxOC43LjAvbm9kZV9tb2R1bGVzL2ZpbGUtdHlwZS9zdXBwb3J0ZWQuanMiLCJub2RlX21vZHVsZXMvLnBucG0vZmlsZS10eXBlQDE4LjcuMC9ub2RlX21vZHVsZXMvZmlsZS10eXBlL2NvcmUuanMiLCJub2RlX21vZHVsZXMvLnBucG0vaW1hZ2UtdHlwZUA1LjIuMC9ub2RlX21vZHVsZXMvaW1hZ2UtdHlwZS9pbmRleC5qcyIsInNyYy9sYW5nL2xvY2FsZS9hci50cyIsInNyYy9sYW5nL2xvY2FsZS9jei50cyIsInNyYy9sYW5nL2xvY2FsZS9kYS50cyIsInNyYy9sYW5nL2xvY2FsZS9kZS50cyIsInNyYy9sYW5nL2xvY2FsZS9lbi50cyIsInNyYy9sYW5nL2xvY2FsZS9lbi1nYi50cyIsInNyYy9sYW5nL2xvY2FsZS9lcy50cyIsInNyYy9sYW5nL2xvY2FsZS9mci50cyIsInNyYy9sYW5nL2xvY2FsZS9oaS50cyIsInNyYy9sYW5nL2xvY2FsZS9pZC50cyIsInNyYy9sYW5nL2xvY2FsZS9pdC50cyIsInNyYy9sYW5nL2xvY2FsZS9qYS50cyIsInNyYy9sYW5nL2xvY2FsZS9rby50cyIsInNyYy9sYW5nL2xvY2FsZS9ubC50cyIsInNyYy9sYW5nL2xvY2FsZS9uby50cyIsInNyYy9sYW5nL2xvY2FsZS9wbC50cyIsInNyYy9sYW5nL2xvY2FsZS9wdC50cyIsInNyYy9sYW5nL2xvY2FsZS9wdC1ici50cyIsInNyYy9sYW5nL2xvY2FsZS9yby50cyIsInNyYy9sYW5nL2xvY2FsZS9ydS50cyIsInNyYy9sYW5nL2xvY2FsZS90ci50cyIsInNyYy9sYW5nL2xvY2FsZS96aC1jbi50cyIsInNyYy9sYW5nL2xvY2FsZS96aC10dy50cyIsInNyYy9sYW5nL2hlbHBlcnMudHMiLCJzcmMvZG93bmxvYWQudHMiLCJzcmMvdXBsb2FkZXIudHMiLCJzcmMvZGVsZXRlci50cyIsInNyYy9oZWxwZXIudHMiLCJzcmMvc2V0dGluZy50cyIsInNyYy9tYWluLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vICdwYXRoJyBtb2R1bGUgZXh0cmFjdGVkIGZyb20gTm9kZS5qcyB2OC4xMS4xIChvbmx5IHRoZSBwb3NpeCBwYXJ0KVxuLy8gdHJhbnNwbGl0ZWQgd2l0aCBCYWJlbFxuXG4vLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBhc3NlcnRQYXRoKHBhdGgpIHtcbiAgaWYgKHR5cGVvZiBwYXRoICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1BhdGggbXVzdCBiZSBhIHN0cmluZy4gUmVjZWl2ZWQgJyArIEpTT04uc3RyaW5naWZ5KHBhdGgpKTtcbiAgfVxufVxuXG4vLyBSZXNvbHZlcyAuIGFuZCAuLiBlbGVtZW50cyBpbiBhIHBhdGggd2l0aCBkaXJlY3RvcnkgbmFtZXNcbmZ1bmN0aW9uIG5vcm1hbGl6ZVN0cmluZ1Bvc2l4KHBhdGgsIGFsbG93QWJvdmVSb290KSB7XG4gIHZhciByZXMgPSAnJztcbiAgdmFyIGxhc3RTZWdtZW50TGVuZ3RoID0gMDtcbiAgdmFyIGxhc3RTbGFzaCA9IC0xO1xuICB2YXIgZG90cyA9IDA7XG4gIHZhciBjb2RlO1xuICBmb3IgKHZhciBpID0gMDsgaSA8PSBwYXRoLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKGkgPCBwYXRoLmxlbmd0aClcbiAgICAgIGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoaSk7XG4gICAgZWxzZSBpZiAoY29kZSA9PT0gNDcgLyovKi8pXG4gICAgICBicmVhaztcbiAgICBlbHNlXG4gICAgICBjb2RlID0gNDcgLyovKi87XG4gICAgaWYgKGNvZGUgPT09IDQ3IC8qLyovKSB7XG4gICAgICBpZiAobGFzdFNsYXNoID09PSBpIC0gMSB8fCBkb3RzID09PSAxKSB7XG4gICAgICAgIC8vIE5PT1BcbiAgICAgIH0gZWxzZSBpZiAobGFzdFNsYXNoICE9PSBpIC0gMSAmJiBkb3RzID09PSAyKSB7XG4gICAgICAgIGlmIChyZXMubGVuZ3RoIDwgMiB8fCBsYXN0U2VnbWVudExlbmd0aCAhPT0gMiB8fCByZXMuY2hhckNvZGVBdChyZXMubGVuZ3RoIC0gMSkgIT09IDQ2IC8qLiovIHx8IHJlcy5jaGFyQ29kZUF0KHJlcy5sZW5ndGggLSAyKSAhPT0gNDYgLyouKi8pIHtcbiAgICAgICAgICBpZiAocmVzLmxlbmd0aCA+IDIpIHtcbiAgICAgICAgICAgIHZhciBsYXN0U2xhc2hJbmRleCA9IHJlcy5sYXN0SW5kZXhPZignLycpO1xuICAgICAgICAgICAgaWYgKGxhc3RTbGFzaEluZGV4ICE9PSByZXMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICBpZiAobGFzdFNsYXNoSW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgcmVzID0gJyc7XG4gICAgICAgICAgICAgICAgbGFzdFNlZ21lbnRMZW5ndGggPSAwO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlcyA9IHJlcy5zbGljZSgwLCBsYXN0U2xhc2hJbmRleCk7XG4gICAgICAgICAgICAgICAgbGFzdFNlZ21lbnRMZW5ndGggPSByZXMubGVuZ3RoIC0gMSAtIHJlcy5sYXN0SW5kZXhPZignLycpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGxhc3RTbGFzaCA9IGk7XG4gICAgICAgICAgICAgIGRvdHMgPSAwO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKHJlcy5sZW5ndGggPT09IDIgfHwgcmVzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgcmVzID0gJyc7XG4gICAgICAgICAgICBsYXN0U2VnbWVudExlbmd0aCA9IDA7XG4gICAgICAgICAgICBsYXN0U2xhc2ggPSBpO1xuICAgICAgICAgICAgZG90cyA9IDA7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFsbG93QWJvdmVSb290KSB7XG4gICAgICAgICAgaWYgKHJlcy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgcmVzICs9ICcvLi4nO1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJlcyA9ICcuLic7XG4gICAgICAgICAgbGFzdFNlZ21lbnRMZW5ndGggPSAyO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocmVzLmxlbmd0aCA+IDApXG4gICAgICAgICAgcmVzICs9ICcvJyArIHBhdGguc2xpY2UobGFzdFNsYXNoICsgMSwgaSk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICByZXMgPSBwYXRoLnNsaWNlKGxhc3RTbGFzaCArIDEsIGkpO1xuICAgICAgICBsYXN0U2VnbWVudExlbmd0aCA9IGkgLSBsYXN0U2xhc2ggLSAxO1xuICAgICAgfVxuICAgICAgbGFzdFNsYXNoID0gaTtcbiAgICAgIGRvdHMgPSAwO1xuICAgIH0gZWxzZSBpZiAoY29kZSA9PT0gNDYgLyouKi8gJiYgZG90cyAhPT0gLTEpIHtcbiAgICAgICsrZG90cztcbiAgICB9IGVsc2Uge1xuICAgICAgZG90cyA9IC0xO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG5mdW5jdGlvbiBfZm9ybWF0KHNlcCwgcGF0aE9iamVjdCkge1xuICB2YXIgZGlyID0gcGF0aE9iamVjdC5kaXIgfHwgcGF0aE9iamVjdC5yb290O1xuICB2YXIgYmFzZSA9IHBhdGhPYmplY3QuYmFzZSB8fCAocGF0aE9iamVjdC5uYW1lIHx8ICcnKSArIChwYXRoT2JqZWN0LmV4dCB8fCAnJyk7XG4gIGlmICghZGlyKSB7XG4gICAgcmV0dXJuIGJhc2U7XG4gIH1cbiAgaWYgKGRpciA9PT0gcGF0aE9iamVjdC5yb290KSB7XG4gICAgcmV0dXJuIGRpciArIGJhc2U7XG4gIH1cbiAgcmV0dXJuIGRpciArIHNlcCArIGJhc2U7XG59XG5cbnZhciBwb3NpeCA9IHtcbiAgLy8gcGF0aC5yZXNvbHZlKFtmcm9tIC4uLl0sIHRvKVxuICByZXNvbHZlOiBmdW5jdGlvbiByZXNvbHZlKCkge1xuICAgIHZhciByZXNvbHZlZFBhdGggPSAnJztcbiAgICB2YXIgcmVzb2x2ZWRBYnNvbHV0ZSA9IGZhbHNlO1xuICAgIHZhciBjd2Q7XG5cbiAgICBmb3IgKHZhciBpID0gYXJndW1lbnRzLmxlbmd0aCAtIDE7IGkgPj0gLTEgJiYgIXJlc29sdmVkQWJzb2x1dGU7IGktLSkge1xuICAgICAgdmFyIHBhdGg7XG4gICAgICBpZiAoaSA+PSAwKVxuICAgICAgICBwYXRoID0gYXJndW1lbnRzW2ldO1xuICAgICAgZWxzZSB7XG4gICAgICAgIGlmIChjd2QgPT09IHVuZGVmaW5lZClcbiAgICAgICAgICBjd2QgPSBwcm9jZXNzLmN3ZCgpO1xuICAgICAgICBwYXRoID0gY3dkO1xuICAgICAgfVxuXG4gICAgICBhc3NlcnRQYXRoKHBhdGgpO1xuXG4gICAgICAvLyBTa2lwIGVtcHR5IGVudHJpZXNcbiAgICAgIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgcmVzb2x2ZWRQYXRoID0gcGF0aCArICcvJyArIHJlc29sdmVkUGF0aDtcbiAgICAgIHJlc29sdmVkQWJzb2x1dGUgPSBwYXRoLmNoYXJDb2RlQXQoMCkgPT09IDQ3IC8qLyovO1xuICAgIH1cblxuICAgIC8vIEF0IHRoaXMgcG9pbnQgdGhlIHBhdGggc2hvdWxkIGJlIHJlc29sdmVkIHRvIGEgZnVsbCBhYnNvbHV0ZSBwYXRoLCBidXRcbiAgICAvLyBoYW5kbGUgcmVsYXRpdmUgcGF0aHMgdG8gYmUgc2FmZSAobWlnaHQgaGFwcGVuIHdoZW4gcHJvY2Vzcy5jd2QoKSBmYWlscylcblxuICAgIC8vIE5vcm1hbGl6ZSB0aGUgcGF0aFxuICAgIHJlc29sdmVkUGF0aCA9IG5vcm1hbGl6ZVN0cmluZ1Bvc2l4KHJlc29sdmVkUGF0aCwgIXJlc29sdmVkQWJzb2x1dGUpO1xuXG4gICAgaWYgKHJlc29sdmVkQWJzb2x1dGUpIHtcbiAgICAgIGlmIChyZXNvbHZlZFBhdGgubGVuZ3RoID4gMClcbiAgICAgICAgcmV0dXJuICcvJyArIHJlc29sdmVkUGF0aDtcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuICcvJztcbiAgICB9IGVsc2UgaWYgKHJlc29sdmVkUGF0aC5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZWRQYXRoO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gJy4nO1xuICAgIH1cbiAgfSxcblxuICBub3JtYWxpemU6IGZ1bmN0aW9uIG5vcm1hbGl6ZShwYXRoKSB7XG4gICAgYXNzZXJ0UGF0aChwYXRoKTtcblxuICAgIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkgcmV0dXJuICcuJztcblxuICAgIHZhciBpc0Fic29sdXRlID0gcGF0aC5jaGFyQ29kZUF0KDApID09PSA0NyAvKi8qLztcbiAgICB2YXIgdHJhaWxpbmdTZXBhcmF0b3IgPSBwYXRoLmNoYXJDb2RlQXQocGF0aC5sZW5ndGggLSAxKSA9PT0gNDcgLyovKi87XG5cbiAgICAvLyBOb3JtYWxpemUgdGhlIHBhdGhcbiAgICBwYXRoID0gbm9ybWFsaXplU3RyaW5nUG9zaXgocGF0aCwgIWlzQWJzb2x1dGUpO1xuXG4gICAgaWYgKHBhdGgubGVuZ3RoID09PSAwICYmICFpc0Fic29sdXRlKSBwYXRoID0gJy4nO1xuICAgIGlmIChwYXRoLmxlbmd0aCA+IDAgJiYgdHJhaWxpbmdTZXBhcmF0b3IpIHBhdGggKz0gJy8nO1xuXG4gICAgaWYgKGlzQWJzb2x1dGUpIHJldHVybiAnLycgKyBwYXRoO1xuICAgIHJldHVybiBwYXRoO1xuICB9LFxuXG4gIGlzQWJzb2x1dGU6IGZ1bmN0aW9uIGlzQWJzb2x1dGUocGF0aCkge1xuICAgIGFzc2VydFBhdGgocGF0aCk7XG4gICAgcmV0dXJuIHBhdGgubGVuZ3RoID4gMCAmJiBwYXRoLmNoYXJDb2RlQXQoMCkgPT09IDQ3IC8qLyovO1xuICB9LFxuXG4gIGpvaW46IGZ1bmN0aW9uIGpvaW4oKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICByZXR1cm4gJy4nO1xuICAgIHZhciBqb2luZWQ7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhciBhcmcgPSBhcmd1bWVudHNbaV07XG4gICAgICBhc3NlcnRQYXRoKGFyZyk7XG4gICAgICBpZiAoYXJnLmxlbmd0aCA+IDApIHtcbiAgICAgICAgaWYgKGpvaW5lZCA9PT0gdW5kZWZpbmVkKVxuICAgICAgICAgIGpvaW5lZCA9IGFyZztcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpvaW5lZCArPSAnLycgKyBhcmc7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChqb2luZWQgPT09IHVuZGVmaW5lZClcbiAgICAgIHJldHVybiAnLic7XG4gICAgcmV0dXJuIHBvc2l4Lm5vcm1hbGl6ZShqb2luZWQpO1xuICB9LFxuXG4gIHJlbGF0aXZlOiBmdW5jdGlvbiByZWxhdGl2ZShmcm9tLCB0bykge1xuICAgIGFzc2VydFBhdGgoZnJvbSk7XG4gICAgYXNzZXJ0UGF0aCh0byk7XG5cbiAgICBpZiAoZnJvbSA9PT0gdG8pIHJldHVybiAnJztcblxuICAgIGZyb20gPSBwb3NpeC5yZXNvbHZlKGZyb20pO1xuICAgIHRvID0gcG9zaXgucmVzb2x2ZSh0byk7XG5cbiAgICBpZiAoZnJvbSA9PT0gdG8pIHJldHVybiAnJztcblxuICAgIC8vIFRyaW0gYW55IGxlYWRpbmcgYmFja3NsYXNoZXNcbiAgICB2YXIgZnJvbVN0YXJ0ID0gMTtcbiAgICBmb3IgKDsgZnJvbVN0YXJ0IDwgZnJvbS5sZW5ndGg7ICsrZnJvbVN0YXJ0KSB7XG4gICAgICBpZiAoZnJvbS5jaGFyQ29kZUF0KGZyb21TdGFydCkgIT09IDQ3IC8qLyovKVxuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgdmFyIGZyb21FbmQgPSBmcm9tLmxlbmd0aDtcbiAgICB2YXIgZnJvbUxlbiA9IGZyb21FbmQgLSBmcm9tU3RhcnQ7XG5cbiAgICAvLyBUcmltIGFueSBsZWFkaW5nIGJhY2tzbGFzaGVzXG4gICAgdmFyIHRvU3RhcnQgPSAxO1xuICAgIGZvciAoOyB0b1N0YXJ0IDwgdG8ubGVuZ3RoOyArK3RvU3RhcnQpIHtcbiAgICAgIGlmICh0by5jaGFyQ29kZUF0KHRvU3RhcnQpICE9PSA0NyAvKi8qLylcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHZhciB0b0VuZCA9IHRvLmxlbmd0aDtcbiAgICB2YXIgdG9MZW4gPSB0b0VuZCAtIHRvU3RhcnQ7XG5cbiAgICAvLyBDb21wYXJlIHBhdGhzIHRvIGZpbmQgdGhlIGxvbmdlc3QgY29tbW9uIHBhdGggZnJvbSByb290XG4gICAgdmFyIGxlbmd0aCA9IGZyb21MZW4gPCB0b0xlbiA/IGZyb21MZW4gOiB0b0xlbjtcbiAgICB2YXIgbGFzdENvbW1vblNlcCA9IC0xO1xuICAgIHZhciBpID0gMDtcbiAgICBmb3IgKDsgaSA8PSBsZW5ndGg7ICsraSkge1xuICAgICAgaWYgKGkgPT09IGxlbmd0aCkge1xuICAgICAgICBpZiAodG9MZW4gPiBsZW5ndGgpIHtcbiAgICAgICAgICBpZiAodG8uY2hhckNvZGVBdCh0b1N0YXJ0ICsgaSkgPT09IDQ3IC8qLyovKSB7XG4gICAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgZnJvbWAgaXMgdGhlIGV4YWN0IGJhc2UgcGF0aCBmb3IgYHRvYC5cbiAgICAgICAgICAgIC8vIEZvciBleGFtcGxlOiBmcm9tPScvZm9vL2Jhcic7IHRvPScvZm9vL2Jhci9iYXonXG4gICAgICAgICAgICByZXR1cm4gdG8uc2xpY2UodG9TdGFydCArIGkgKyAxKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGkgPT09IDApIHtcbiAgICAgICAgICAgIC8vIFdlIGdldCBoZXJlIGlmIGBmcm9tYCBpcyB0aGUgcm9vdFxuICAgICAgICAgICAgLy8gRm9yIGV4YW1wbGU6IGZyb209Jy8nOyB0bz0nL2ZvbydcbiAgICAgICAgICAgIHJldHVybiB0by5zbGljZSh0b1N0YXJ0ICsgaSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGZyb21MZW4gPiBsZW5ndGgpIHtcbiAgICAgICAgICBpZiAoZnJvbS5jaGFyQ29kZUF0KGZyb21TdGFydCArIGkpID09PSA0NyAvKi8qLykge1xuICAgICAgICAgICAgLy8gV2UgZ2V0IGhlcmUgaWYgYHRvYCBpcyB0aGUgZXhhY3QgYmFzZSBwYXRoIGZvciBgZnJvbWAuXG4gICAgICAgICAgICAvLyBGb3IgZXhhbXBsZTogZnJvbT0nL2Zvby9iYXIvYmF6JzsgdG89Jy9mb28vYmFyJ1xuICAgICAgICAgICAgbGFzdENvbW1vblNlcCA9IGk7XG4gICAgICAgICAgfSBlbHNlIGlmIChpID09PSAwKSB7XG4gICAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgdG9gIGlzIHRoZSByb290LlxuICAgICAgICAgICAgLy8gRm9yIGV4YW1wbGU6IGZyb209Jy9mb28nOyB0bz0nLydcbiAgICAgICAgICAgIGxhc3RDb21tb25TZXAgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHZhciBmcm9tQ29kZSA9IGZyb20uY2hhckNvZGVBdChmcm9tU3RhcnQgKyBpKTtcbiAgICAgIHZhciB0b0NvZGUgPSB0by5jaGFyQ29kZUF0KHRvU3RhcnQgKyBpKTtcbiAgICAgIGlmIChmcm9tQ29kZSAhPT0gdG9Db2RlKVxuICAgICAgICBicmVhaztcbiAgICAgIGVsc2UgaWYgKGZyb21Db2RlID09PSA0NyAvKi8qLylcbiAgICAgICAgbGFzdENvbW1vblNlcCA9IGk7XG4gICAgfVxuXG4gICAgdmFyIG91dCA9ICcnO1xuICAgIC8vIEdlbmVyYXRlIHRoZSByZWxhdGl2ZSBwYXRoIGJhc2VkIG9uIHRoZSBwYXRoIGRpZmZlcmVuY2UgYmV0d2VlbiBgdG9gXG4gICAgLy8gYW5kIGBmcm9tYFxuICAgIGZvciAoaSA9IGZyb21TdGFydCArIGxhc3RDb21tb25TZXAgKyAxOyBpIDw9IGZyb21FbmQ7ICsraSkge1xuICAgICAgaWYgKGkgPT09IGZyb21FbmQgfHwgZnJvbS5jaGFyQ29kZUF0KGkpID09PSA0NyAvKi8qLykge1xuICAgICAgICBpZiAob3V0Lmxlbmd0aCA9PT0gMClcbiAgICAgICAgICBvdXQgKz0gJy4uJztcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG91dCArPSAnLy4uJztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBMYXN0bHksIGFwcGVuZCB0aGUgcmVzdCBvZiB0aGUgZGVzdGluYXRpb24gKGB0b2ApIHBhdGggdGhhdCBjb21lcyBhZnRlclxuICAgIC8vIHRoZSBjb21tb24gcGF0aCBwYXJ0c1xuICAgIGlmIChvdXQubGVuZ3RoID4gMClcbiAgICAgIHJldHVybiBvdXQgKyB0by5zbGljZSh0b1N0YXJ0ICsgbGFzdENvbW1vblNlcCk7XG4gICAgZWxzZSB7XG4gICAgICB0b1N0YXJ0ICs9IGxhc3RDb21tb25TZXA7XG4gICAgICBpZiAodG8uY2hhckNvZGVBdCh0b1N0YXJ0KSA9PT0gNDcgLyovKi8pXG4gICAgICAgICsrdG9TdGFydDtcbiAgICAgIHJldHVybiB0by5zbGljZSh0b1N0YXJ0KTtcbiAgICB9XG4gIH0sXG5cbiAgX21ha2VMb25nOiBmdW5jdGlvbiBfbWFrZUxvbmcocGF0aCkge1xuICAgIHJldHVybiBwYXRoO1xuICB9LFxuXG4gIGRpcm5hbWU6IGZ1bmN0aW9uIGRpcm5hbWUocGF0aCkge1xuICAgIGFzc2VydFBhdGgocGF0aCk7XG4gICAgaWYgKHBhdGgubGVuZ3RoID09PSAwKSByZXR1cm4gJy4nO1xuICAgIHZhciBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KDApO1xuICAgIHZhciBoYXNSb290ID0gY29kZSA9PT0gNDcgLyovKi87XG4gICAgdmFyIGVuZCA9IC0xO1xuICAgIHZhciBtYXRjaGVkU2xhc2ggPSB0cnVlO1xuICAgIGZvciAodmFyIGkgPSBwYXRoLmxlbmd0aCAtIDE7IGkgPj0gMTsgLS1pKSB7XG4gICAgICBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KGkpO1xuICAgICAgaWYgKGNvZGUgPT09IDQ3IC8qLyovKSB7XG4gICAgICAgICAgaWYgKCFtYXRjaGVkU2xhc2gpIHtcbiAgICAgICAgICAgIGVuZCA9IGk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yXG4gICAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChlbmQgPT09IC0xKSByZXR1cm4gaGFzUm9vdCA/ICcvJyA6ICcuJztcbiAgICBpZiAoaGFzUm9vdCAmJiBlbmQgPT09IDEpIHJldHVybiAnLy8nO1xuICAgIHJldHVybiBwYXRoLnNsaWNlKDAsIGVuZCk7XG4gIH0sXG5cbiAgYmFzZW5hbWU6IGZ1bmN0aW9uIGJhc2VuYW1lKHBhdGgsIGV4dCkge1xuICAgIGlmIChleHQgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgZXh0ICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJleHRcIiBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nJyk7XG4gICAgYXNzZXJ0UGF0aChwYXRoKTtcblxuICAgIHZhciBzdGFydCA9IDA7XG4gICAgdmFyIGVuZCA9IC0xO1xuICAgIHZhciBtYXRjaGVkU2xhc2ggPSB0cnVlO1xuICAgIHZhciBpO1xuXG4gICAgaWYgKGV4dCAhPT0gdW5kZWZpbmVkICYmIGV4dC5sZW5ndGggPiAwICYmIGV4dC5sZW5ndGggPD0gcGF0aC5sZW5ndGgpIHtcbiAgICAgIGlmIChleHQubGVuZ3RoID09PSBwYXRoLmxlbmd0aCAmJiBleHQgPT09IHBhdGgpIHJldHVybiAnJztcbiAgICAgIHZhciBleHRJZHggPSBleHQubGVuZ3RoIC0gMTtcbiAgICAgIHZhciBmaXJzdE5vblNsYXNoRW5kID0gLTE7XG4gICAgICBmb3IgKGkgPSBwYXRoLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICAgIHZhciBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KGkpO1xuICAgICAgICBpZiAoY29kZSA9PT0gNDcgLyovKi8pIHtcbiAgICAgICAgICAgIC8vIElmIHdlIHJlYWNoZWQgYSBwYXRoIHNlcGFyYXRvciB0aGF0IHdhcyBub3QgcGFydCBvZiBhIHNldCBvZiBwYXRoXG4gICAgICAgICAgICAvLyBzZXBhcmF0b3JzIGF0IHRoZSBlbmQgb2YgdGhlIHN0cmluZywgc3RvcCBub3dcbiAgICAgICAgICAgIGlmICghbWF0Y2hlZFNsYXNoKSB7XG4gICAgICAgICAgICAgIHN0YXJ0ID0gaSArIDE7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGZpcnN0Tm9uU2xhc2hFbmQgPT09IC0xKSB7XG4gICAgICAgICAgICAvLyBXZSBzYXcgdGhlIGZpcnN0IG5vbi1wYXRoIHNlcGFyYXRvciwgcmVtZW1iZXIgdGhpcyBpbmRleCBpbiBjYXNlXG4gICAgICAgICAgICAvLyB3ZSBuZWVkIGl0IGlmIHRoZSBleHRlbnNpb24gZW5kcyB1cCBub3QgbWF0Y2hpbmdcbiAgICAgICAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgICAgICAgICAgZmlyc3ROb25TbGFzaEVuZCA9IGkgKyAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZXh0SWR4ID49IDApIHtcbiAgICAgICAgICAgIC8vIFRyeSB0byBtYXRjaCB0aGUgZXhwbGljaXQgZXh0ZW5zaW9uXG4gICAgICAgICAgICBpZiAoY29kZSA9PT0gZXh0LmNoYXJDb2RlQXQoZXh0SWR4KSkge1xuICAgICAgICAgICAgICBpZiAoLS1leHRJZHggPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgLy8gV2UgbWF0Y2hlZCB0aGUgZXh0ZW5zaW9uLCBzbyBtYXJrIHRoaXMgYXMgdGhlIGVuZCBvZiBvdXIgcGF0aFxuICAgICAgICAgICAgICAgIC8vIGNvbXBvbmVudFxuICAgICAgICAgICAgICAgIGVuZCA9IGk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIEV4dGVuc2lvbiBkb2VzIG5vdCBtYXRjaCwgc28gb3VyIHJlc3VsdCBpcyB0aGUgZW50aXJlIHBhdGhcbiAgICAgICAgICAgICAgLy8gY29tcG9uZW50XG4gICAgICAgICAgICAgIGV4dElkeCA9IC0xO1xuICAgICAgICAgICAgICBlbmQgPSBmaXJzdE5vblNsYXNoRW5kO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoc3RhcnQgPT09IGVuZCkgZW5kID0gZmlyc3ROb25TbGFzaEVuZDtlbHNlIGlmIChlbmQgPT09IC0xKSBlbmQgPSBwYXRoLmxlbmd0aDtcbiAgICAgIHJldHVybiBwYXRoLnNsaWNlKHN0YXJ0LCBlbmQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGkgPSBwYXRoLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICAgIGlmIChwYXRoLmNoYXJDb2RlQXQoaSkgPT09IDQ3IC8qLyovKSB7XG4gICAgICAgICAgICAvLyBJZiB3ZSByZWFjaGVkIGEgcGF0aCBzZXBhcmF0b3IgdGhhdCB3YXMgbm90IHBhcnQgb2YgYSBzZXQgb2YgcGF0aFxuICAgICAgICAgICAgLy8gc2VwYXJhdG9ycyBhdCB0aGUgZW5kIG9mIHRoZSBzdHJpbmcsIHN0b3Agbm93XG4gICAgICAgICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICAgICAgICBzdGFydCA9IGkgKyAxO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKGVuZCA9PT0gLTEpIHtcbiAgICAgICAgICAvLyBXZSBzYXcgdGhlIGZpcnN0IG5vbi1wYXRoIHNlcGFyYXRvciwgbWFyayB0aGlzIGFzIHRoZSBlbmQgb2Ygb3VyXG4gICAgICAgICAgLy8gcGF0aCBjb21wb25lbnRcbiAgICAgICAgICBtYXRjaGVkU2xhc2ggPSBmYWxzZTtcbiAgICAgICAgICBlbmQgPSBpICsgMTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZW5kID09PSAtMSkgcmV0dXJuICcnO1xuICAgICAgcmV0dXJuIHBhdGguc2xpY2Uoc3RhcnQsIGVuZCk7XG4gICAgfVxuICB9LFxuXG4gIGV4dG5hbWU6IGZ1bmN0aW9uIGV4dG5hbWUocGF0aCkge1xuICAgIGFzc2VydFBhdGgocGF0aCk7XG4gICAgdmFyIHN0YXJ0RG90ID0gLTE7XG4gICAgdmFyIHN0YXJ0UGFydCA9IDA7XG4gICAgdmFyIGVuZCA9IC0xO1xuICAgIHZhciBtYXRjaGVkU2xhc2ggPSB0cnVlO1xuICAgIC8vIFRyYWNrIHRoZSBzdGF0ZSBvZiBjaGFyYWN0ZXJzIChpZiBhbnkpIHdlIHNlZSBiZWZvcmUgb3VyIGZpcnN0IGRvdCBhbmRcbiAgICAvLyBhZnRlciBhbnkgcGF0aCBzZXBhcmF0b3Igd2UgZmluZFxuICAgIHZhciBwcmVEb3RTdGF0ZSA9IDA7XG4gICAgZm9yICh2YXIgaSA9IHBhdGgubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgIHZhciBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KGkpO1xuICAgICAgaWYgKGNvZGUgPT09IDQ3IC8qLyovKSB7XG4gICAgICAgICAgLy8gSWYgd2UgcmVhY2hlZCBhIHBhdGggc2VwYXJhdG9yIHRoYXQgd2FzIG5vdCBwYXJ0IG9mIGEgc2V0IG9mIHBhdGhcbiAgICAgICAgICAvLyBzZXBhcmF0b3JzIGF0IHRoZSBlbmQgb2YgdGhlIHN0cmluZywgc3RvcCBub3dcbiAgICAgICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICAgICAgc3RhcnRQYXJ0ID0gaSArIDE7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIGlmIChlbmQgPT09IC0xKSB7XG4gICAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCBtYXJrIHRoaXMgYXMgdGhlIGVuZCBvZiBvdXJcbiAgICAgICAgLy8gZXh0ZW5zaW9uXG4gICAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgICAgICBlbmQgPSBpICsgMTtcbiAgICAgIH1cbiAgICAgIGlmIChjb2RlID09PSA0NiAvKi4qLykge1xuICAgICAgICAgIC8vIElmIHRoaXMgaXMgb3VyIGZpcnN0IGRvdCwgbWFyayBpdCBhcyB0aGUgc3RhcnQgb2Ygb3VyIGV4dGVuc2lvblxuICAgICAgICAgIGlmIChzdGFydERvdCA9PT0gLTEpXG4gICAgICAgICAgICBzdGFydERvdCA9IGk7XG4gICAgICAgICAgZWxzZSBpZiAocHJlRG90U3RhdGUgIT09IDEpXG4gICAgICAgICAgICBwcmVEb3RTdGF0ZSA9IDE7XG4gICAgICB9IGVsc2UgaWYgKHN0YXJ0RG90ICE9PSAtMSkge1xuICAgICAgICAvLyBXZSBzYXcgYSBub24tZG90IGFuZCBub24tcGF0aCBzZXBhcmF0b3IgYmVmb3JlIG91ciBkb3QsIHNvIHdlIHNob3VsZFxuICAgICAgICAvLyBoYXZlIGEgZ29vZCBjaGFuY2UgYXQgaGF2aW5nIGEgbm9uLWVtcHR5IGV4dGVuc2lvblxuICAgICAgICBwcmVEb3RTdGF0ZSA9IC0xO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdGFydERvdCA9PT0gLTEgfHwgZW5kID09PSAtMSB8fFxuICAgICAgICAvLyBXZSBzYXcgYSBub24tZG90IGNoYXJhY3RlciBpbW1lZGlhdGVseSBiZWZvcmUgdGhlIGRvdFxuICAgICAgICBwcmVEb3RTdGF0ZSA9PT0gMCB8fFxuICAgICAgICAvLyBUaGUgKHJpZ2h0LW1vc3QpIHRyaW1tZWQgcGF0aCBjb21wb25lbnQgaXMgZXhhY3RseSAnLi4nXG4gICAgICAgIHByZURvdFN0YXRlID09PSAxICYmIHN0YXJ0RG90ID09PSBlbmQgLSAxICYmIHN0YXJ0RG90ID09PSBzdGFydFBhcnQgKyAxKSB7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIHJldHVybiBwYXRoLnNsaWNlKHN0YXJ0RG90LCBlbmQpO1xuICB9LFxuXG4gIGZvcm1hdDogZnVuY3Rpb24gZm9ybWF0KHBhdGhPYmplY3QpIHtcbiAgICBpZiAocGF0aE9iamVjdCA9PT0gbnVsbCB8fCB0eXBlb2YgcGF0aE9iamVjdCAhPT0gJ29iamVjdCcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcInBhdGhPYmplY3RcIiBhcmd1bWVudCBtdXN0IGJlIG9mIHR5cGUgT2JqZWN0LiBSZWNlaXZlZCB0eXBlICcgKyB0eXBlb2YgcGF0aE9iamVjdCk7XG4gICAgfVxuICAgIHJldHVybiBfZm9ybWF0KCcvJywgcGF0aE9iamVjdCk7XG4gIH0sXG5cbiAgcGFyc2U6IGZ1bmN0aW9uIHBhcnNlKHBhdGgpIHtcbiAgICBhc3NlcnRQYXRoKHBhdGgpO1xuXG4gICAgdmFyIHJldCA9IHsgcm9vdDogJycsIGRpcjogJycsIGJhc2U6ICcnLCBleHQ6ICcnLCBuYW1lOiAnJyB9O1xuICAgIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHJldDtcbiAgICB2YXIgY29kZSA9IHBhdGguY2hhckNvZGVBdCgwKTtcbiAgICB2YXIgaXNBYnNvbHV0ZSA9IGNvZGUgPT09IDQ3IC8qLyovO1xuICAgIHZhciBzdGFydDtcbiAgICBpZiAoaXNBYnNvbHV0ZSkge1xuICAgICAgcmV0LnJvb3QgPSAnLyc7XG4gICAgICBzdGFydCA9IDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXJ0ID0gMDtcbiAgICB9XG4gICAgdmFyIHN0YXJ0RG90ID0gLTE7XG4gICAgdmFyIHN0YXJ0UGFydCA9IDA7XG4gICAgdmFyIGVuZCA9IC0xO1xuICAgIHZhciBtYXRjaGVkU2xhc2ggPSB0cnVlO1xuICAgIHZhciBpID0gcGF0aC5sZW5ndGggLSAxO1xuXG4gICAgLy8gVHJhY2sgdGhlIHN0YXRlIG9mIGNoYXJhY3RlcnMgKGlmIGFueSkgd2Ugc2VlIGJlZm9yZSBvdXIgZmlyc3QgZG90IGFuZFxuICAgIC8vIGFmdGVyIGFueSBwYXRoIHNlcGFyYXRvciB3ZSBmaW5kXG4gICAgdmFyIHByZURvdFN0YXRlID0gMDtcblxuICAgIC8vIEdldCBub24tZGlyIGluZm9cbiAgICBmb3IgKDsgaSA+PSBzdGFydDsgLS1pKSB7XG4gICAgICBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KGkpO1xuICAgICAgaWYgKGNvZGUgPT09IDQ3IC8qLyovKSB7XG4gICAgICAgICAgLy8gSWYgd2UgcmVhY2hlZCBhIHBhdGggc2VwYXJhdG9yIHRoYXQgd2FzIG5vdCBwYXJ0IG9mIGEgc2V0IG9mIHBhdGhcbiAgICAgICAgICAvLyBzZXBhcmF0b3JzIGF0IHRoZSBlbmQgb2YgdGhlIHN0cmluZywgc3RvcCBub3dcbiAgICAgICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICAgICAgc3RhcnRQYXJ0ID0gaSArIDE7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIGlmIChlbmQgPT09IC0xKSB7XG4gICAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCBtYXJrIHRoaXMgYXMgdGhlIGVuZCBvZiBvdXJcbiAgICAgICAgLy8gZXh0ZW5zaW9uXG4gICAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgICAgICBlbmQgPSBpICsgMTtcbiAgICAgIH1cbiAgICAgIGlmIChjb2RlID09PSA0NiAvKi4qLykge1xuICAgICAgICAgIC8vIElmIHRoaXMgaXMgb3VyIGZpcnN0IGRvdCwgbWFyayBpdCBhcyB0aGUgc3RhcnQgb2Ygb3VyIGV4dGVuc2lvblxuICAgICAgICAgIGlmIChzdGFydERvdCA9PT0gLTEpIHN0YXJ0RG90ID0gaTtlbHNlIGlmIChwcmVEb3RTdGF0ZSAhPT0gMSkgcHJlRG90U3RhdGUgPSAxO1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXJ0RG90ICE9PSAtMSkge1xuICAgICAgICAvLyBXZSBzYXcgYSBub24tZG90IGFuZCBub24tcGF0aCBzZXBhcmF0b3IgYmVmb3JlIG91ciBkb3QsIHNvIHdlIHNob3VsZFxuICAgICAgICAvLyBoYXZlIGEgZ29vZCBjaGFuY2UgYXQgaGF2aW5nIGEgbm9uLWVtcHR5IGV4dGVuc2lvblxuICAgICAgICBwcmVEb3RTdGF0ZSA9IC0xO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdGFydERvdCA9PT0gLTEgfHwgZW5kID09PSAtMSB8fFxuICAgIC8vIFdlIHNhdyBhIG5vbi1kb3QgY2hhcmFjdGVyIGltbWVkaWF0ZWx5IGJlZm9yZSB0aGUgZG90XG4gICAgcHJlRG90U3RhdGUgPT09IDAgfHxcbiAgICAvLyBUaGUgKHJpZ2h0LW1vc3QpIHRyaW1tZWQgcGF0aCBjb21wb25lbnQgaXMgZXhhY3RseSAnLi4nXG4gICAgcHJlRG90U3RhdGUgPT09IDEgJiYgc3RhcnREb3QgPT09IGVuZCAtIDEgJiYgc3RhcnREb3QgPT09IHN0YXJ0UGFydCArIDEpIHtcbiAgICAgIGlmIChlbmQgIT09IC0xKSB7XG4gICAgICAgIGlmIChzdGFydFBhcnQgPT09IDAgJiYgaXNBYnNvbHV0ZSkgcmV0LmJhc2UgPSByZXQubmFtZSA9IHBhdGguc2xpY2UoMSwgZW5kKTtlbHNlIHJldC5iYXNlID0gcmV0Lm5hbWUgPSBwYXRoLnNsaWNlKHN0YXJ0UGFydCwgZW5kKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHN0YXJ0UGFydCA9PT0gMCAmJiBpc0Fic29sdXRlKSB7XG4gICAgICAgIHJldC5uYW1lID0gcGF0aC5zbGljZSgxLCBzdGFydERvdCk7XG4gICAgICAgIHJldC5iYXNlID0gcGF0aC5zbGljZSgxLCBlbmQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0Lm5hbWUgPSBwYXRoLnNsaWNlKHN0YXJ0UGFydCwgc3RhcnREb3QpO1xuICAgICAgICByZXQuYmFzZSA9IHBhdGguc2xpY2Uoc3RhcnRQYXJ0LCBlbmQpO1xuICAgICAgfVxuICAgICAgcmV0LmV4dCA9IHBhdGguc2xpY2Uoc3RhcnREb3QsIGVuZCk7XG4gICAgfVxuXG4gICAgaWYgKHN0YXJ0UGFydCA+IDApIHJldC5kaXIgPSBwYXRoLnNsaWNlKDAsIHN0YXJ0UGFydCAtIDEpO2Vsc2UgaWYgKGlzQWJzb2x1dGUpIHJldC5kaXIgPSAnLyc7XG5cbiAgICByZXR1cm4gcmV0O1xuICB9LFxuXG4gIHNlcDogJy8nLFxuICBkZWxpbWl0ZXI6ICc6JyxcbiAgd2luMzI6IG51bGwsXG4gIHBvc2l4OiBudWxsXG59O1xuXG5wb3NpeC5wb3NpeCA9IHBvc2l4O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHBvc2l4O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBpc2V4ZVxuaXNleGUuc3luYyA9IHN5bmNcblxudmFyIGZzID0gcmVxdWlyZSgnZnMnKVxuXG5mdW5jdGlvbiBjaGVja1BhdGhFeHQgKHBhdGgsIG9wdGlvbnMpIHtcbiAgdmFyIHBhdGhleHQgPSBvcHRpb25zLnBhdGhFeHQgIT09IHVuZGVmaW5lZCA/XG4gICAgb3B0aW9ucy5wYXRoRXh0IDogcHJvY2Vzcy5lbnYuUEFUSEVYVFxuXG4gIGlmICghcGF0aGV4dCkge1xuICAgIHJldHVybiB0cnVlXG4gIH1cblxuICBwYXRoZXh0ID0gcGF0aGV4dC5zcGxpdCgnOycpXG4gIGlmIChwYXRoZXh0LmluZGV4T2YoJycpICE9PSAtMSkge1xuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXRoZXh0Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHAgPSBwYXRoZXh0W2ldLnRvTG93ZXJDYXNlKClcbiAgICBpZiAocCAmJiBwYXRoLnN1YnN0cigtcC5sZW5ndGgpLnRvTG93ZXJDYXNlKCkgPT09IHApIHtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZVxufVxuXG5mdW5jdGlvbiBjaGVja1N0YXQgKHN0YXQsIHBhdGgsIG9wdGlvbnMpIHtcbiAgaWYgKCFzdGF0LmlzU3ltYm9saWNMaW5rKCkgJiYgIXN0YXQuaXNGaWxlKCkpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICByZXR1cm4gY2hlY2tQYXRoRXh0KHBhdGgsIG9wdGlvbnMpXG59XG5cbmZ1bmN0aW9uIGlzZXhlIChwYXRoLCBvcHRpb25zLCBjYikge1xuICBmcy5zdGF0KHBhdGgsIGZ1bmN0aW9uIChlciwgc3RhdCkge1xuICAgIGNiKGVyLCBlciA/IGZhbHNlIDogY2hlY2tTdGF0KHN0YXQsIHBhdGgsIG9wdGlvbnMpKVxuICB9KVxufVxuXG5mdW5jdGlvbiBzeW5jIChwYXRoLCBvcHRpb25zKSB7XG4gIHJldHVybiBjaGVja1N0YXQoZnMuc3RhdFN5bmMocGF0aCksIHBhdGgsIG9wdGlvbnMpXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGlzZXhlXG5pc2V4ZS5zeW5jID0gc3luY1xuXG52YXIgZnMgPSByZXF1aXJlKCdmcycpXG5cbmZ1bmN0aW9uIGlzZXhlIChwYXRoLCBvcHRpb25zLCBjYikge1xuICBmcy5zdGF0KHBhdGgsIGZ1bmN0aW9uIChlciwgc3RhdCkge1xuICAgIGNiKGVyLCBlciA/IGZhbHNlIDogY2hlY2tTdGF0KHN0YXQsIG9wdGlvbnMpKVxuICB9KVxufVxuXG5mdW5jdGlvbiBzeW5jIChwYXRoLCBvcHRpb25zKSB7XG4gIHJldHVybiBjaGVja1N0YXQoZnMuc3RhdFN5bmMocGF0aCksIG9wdGlvbnMpXG59XG5cbmZ1bmN0aW9uIGNoZWNrU3RhdCAoc3RhdCwgb3B0aW9ucykge1xuICByZXR1cm4gc3RhdC5pc0ZpbGUoKSAmJiBjaGVja01vZGUoc3RhdCwgb3B0aW9ucylcbn1cblxuZnVuY3Rpb24gY2hlY2tNb2RlIChzdGF0LCBvcHRpb25zKSB7XG4gIHZhciBtb2QgPSBzdGF0Lm1vZGVcbiAgdmFyIHVpZCA9IHN0YXQudWlkXG4gIHZhciBnaWQgPSBzdGF0LmdpZFxuXG4gIHZhciBteVVpZCA9IG9wdGlvbnMudWlkICE9PSB1bmRlZmluZWQgP1xuICAgIG9wdGlvbnMudWlkIDogcHJvY2Vzcy5nZXR1aWQgJiYgcHJvY2Vzcy5nZXR1aWQoKVxuICB2YXIgbXlHaWQgPSBvcHRpb25zLmdpZCAhPT0gdW5kZWZpbmVkID9cbiAgICBvcHRpb25zLmdpZCA6IHByb2Nlc3MuZ2V0Z2lkICYmIHByb2Nlc3MuZ2V0Z2lkKClcblxuICB2YXIgdSA9IHBhcnNlSW50KCcxMDAnLCA4KVxuICB2YXIgZyA9IHBhcnNlSW50KCcwMTAnLCA4KVxuICB2YXIgbyA9IHBhcnNlSW50KCcwMDEnLCA4KVxuICB2YXIgdWcgPSB1IHwgZ1xuXG4gIHZhciByZXQgPSAobW9kICYgbykgfHxcbiAgICAobW9kICYgZykgJiYgZ2lkID09PSBteUdpZCB8fFxuICAgIChtb2QgJiB1KSAmJiB1aWQgPT09IG15VWlkIHx8XG4gICAgKG1vZCAmIHVnKSAmJiBteVVpZCA9PT0gMFxuXG4gIHJldHVybiByZXRcbn1cbiIsInZhciBmcyA9IHJlcXVpcmUoJ2ZzJylcbnZhciBjb3JlXG5pZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyB8fCBnbG9iYWwuVEVTVElOR19XSU5ET1dTKSB7XG4gIGNvcmUgPSByZXF1aXJlKCcuL3dpbmRvd3MuanMnKVxufSBlbHNlIHtcbiAgY29yZSA9IHJlcXVpcmUoJy4vbW9kZS5qcycpXG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNleGVcbmlzZXhlLnN5bmMgPSBzeW5jXG5cbmZ1bmN0aW9uIGlzZXhlIChwYXRoLCBvcHRpb25zLCBjYikge1xuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjYiA9IG9wdGlvbnNcbiAgICBvcHRpb25zID0ge31cbiAgfVxuXG4gIGlmICghY2IpIHtcbiAgICBpZiAodHlwZW9mIFByb21pc2UgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NhbGxiYWNrIG5vdCBwcm92aWRlZCcpXG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIGlzZXhlKHBhdGgsIG9wdGlvbnMgfHwge30sIGZ1bmN0aW9uIChlciwgaXMpIHtcbiAgICAgICAgaWYgKGVyKSB7XG4gICAgICAgICAgcmVqZWN0KGVyKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc29sdmUoaXMpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSlcbiAgfVxuXG4gIGNvcmUocGF0aCwgb3B0aW9ucyB8fCB7fSwgZnVuY3Rpb24gKGVyLCBpcykge1xuICAgIC8vIGlnbm9yZSBFQUNDRVMgYmVjYXVzZSB0aGF0IGp1c3QgbWVhbnMgd2UgYXJlbid0IGFsbG93ZWQgdG8gcnVuIGl0XG4gICAgaWYgKGVyKSB7XG4gICAgICBpZiAoZXIuY29kZSA9PT0gJ0VBQ0NFUycgfHwgb3B0aW9ucyAmJiBvcHRpb25zLmlnbm9yZUVycm9ycykge1xuICAgICAgICBlciA9IG51bGxcbiAgICAgICAgaXMgPSBmYWxzZVxuICAgICAgfVxuICAgIH1cbiAgICBjYihlciwgaXMpXG4gIH0pXG59XG5cbmZ1bmN0aW9uIHN5bmMgKHBhdGgsIG9wdGlvbnMpIHtcbiAgLy8gbXkga2luZ2RvbSBmb3IgYSBmaWx0ZXJlZCBjYXRjaFxuICB0cnkge1xuICAgIHJldHVybiBjb3JlLnN5bmMocGF0aCwgb3B0aW9ucyB8fCB7fSlcbiAgfSBjYXRjaCAoZXIpIHtcbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmlnbm9yZUVycm9ycyB8fCBlci5jb2RlID09PSAnRUFDQ0VTJykge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGVyXG4gICAgfVxuICB9XG59XG4iLCJjb25zdCBpc1dpbmRvd3MgPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInIHx8XG4gICAgcHJvY2Vzcy5lbnYuT1NUWVBFID09PSAnY3lnd2luJyB8fFxuICAgIHByb2Nlc3MuZW52Lk9TVFlQRSA9PT0gJ21zeXMnXG5cbmNvbnN0IHBhdGggPSByZXF1aXJlKCdwYXRoJylcbmNvbnN0IENPTE9OID0gaXNXaW5kb3dzID8gJzsnIDogJzonXG5jb25zdCBpc2V4ZSA9IHJlcXVpcmUoJ2lzZXhlJylcblxuY29uc3QgZ2V0Tm90Rm91bmRFcnJvciA9IChjbWQpID0+XG4gIE9iamVjdC5hc3NpZ24obmV3IEVycm9yKGBub3QgZm91bmQ6ICR7Y21kfWApLCB7IGNvZGU6ICdFTk9FTlQnIH0pXG5cbmNvbnN0IGdldFBhdGhJbmZvID0gKGNtZCwgb3B0KSA9PiB7XG4gIGNvbnN0IGNvbG9uID0gb3B0LmNvbG9uIHx8IENPTE9OXG5cbiAgLy8gSWYgaXQgaGFzIGEgc2xhc2gsIHRoZW4gd2UgZG9uJ3QgYm90aGVyIHNlYXJjaGluZyB0aGUgcGF0aGVudi5cbiAgLy8ganVzdCBjaGVjayB0aGUgZmlsZSBpdHNlbGYsIGFuZCB0aGF0J3MgaXQuXG4gIGNvbnN0IHBhdGhFbnYgPSBjbWQubWF0Y2goL1xcLy8pIHx8IGlzV2luZG93cyAmJiBjbWQubWF0Y2goL1xcXFwvKSA/IFsnJ11cbiAgICA6IChcbiAgICAgIFtcbiAgICAgICAgLy8gd2luZG93cyBhbHdheXMgY2hlY2tzIHRoZSBjd2QgZmlyc3RcbiAgICAgICAgLi4uKGlzV2luZG93cyA/IFtwcm9jZXNzLmN3ZCgpXSA6IFtdKSxcbiAgICAgICAgLi4uKG9wdC5wYXRoIHx8IHByb2Nlc3MuZW52LlBBVEggfHxcbiAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dDogdmVyeSB1bnVzdWFsICovICcnKS5zcGxpdChjb2xvbiksXG4gICAgICBdXG4gICAgKVxuICBjb25zdCBwYXRoRXh0RXhlID0gaXNXaW5kb3dzXG4gICAgPyBvcHQucGF0aEV4dCB8fCBwcm9jZXNzLmVudi5QQVRIRVhUIHx8ICcuRVhFOy5DTUQ7LkJBVDsuQ09NJ1xuICAgIDogJydcbiAgY29uc3QgcGF0aEV4dCA9IGlzV2luZG93cyA/IHBhdGhFeHRFeGUuc3BsaXQoY29sb24pIDogWycnXVxuXG4gIGlmIChpc1dpbmRvd3MpIHtcbiAgICBpZiAoY21kLmluZGV4T2YoJy4nKSAhPT0gLTEgJiYgcGF0aEV4dFswXSAhPT0gJycpXG4gICAgICBwYXRoRXh0LnVuc2hpZnQoJycpXG4gIH1cblxuICByZXR1cm4ge1xuICAgIHBhdGhFbnYsXG4gICAgcGF0aEV4dCxcbiAgICBwYXRoRXh0RXhlLFxuICB9XG59XG5cbmNvbnN0IHdoaWNoID0gKGNtZCwgb3B0LCBjYikgPT4ge1xuICBpZiAodHlwZW9mIG9wdCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNiID0gb3B0XG4gICAgb3B0ID0ge31cbiAgfVxuICBpZiAoIW9wdClcbiAgICBvcHQgPSB7fVxuXG4gIGNvbnN0IHsgcGF0aEVudiwgcGF0aEV4dCwgcGF0aEV4dEV4ZSB9ID0gZ2V0UGF0aEluZm8oY21kLCBvcHQpXG4gIGNvbnN0IGZvdW5kID0gW11cblxuICBjb25zdCBzdGVwID0gaSA9PiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgaWYgKGkgPT09IHBhdGhFbnYubGVuZ3RoKVxuICAgICAgcmV0dXJuIG9wdC5hbGwgJiYgZm91bmQubGVuZ3RoID8gcmVzb2x2ZShmb3VuZClcbiAgICAgICAgOiByZWplY3QoZ2V0Tm90Rm91bmRFcnJvcihjbWQpKVxuXG4gICAgY29uc3QgcHBSYXcgPSBwYXRoRW52W2ldXG4gICAgY29uc3QgcGF0aFBhcnQgPSAvXlwiLipcIiQvLnRlc3QocHBSYXcpID8gcHBSYXcuc2xpY2UoMSwgLTEpIDogcHBSYXdcblxuICAgIGNvbnN0IHBDbWQgPSBwYXRoLmpvaW4ocGF0aFBhcnQsIGNtZClcbiAgICBjb25zdCBwID0gIXBhdGhQYXJ0ICYmIC9eXFwuW1xcXFxcXC9dLy50ZXN0KGNtZCkgPyBjbWQuc2xpY2UoMCwgMikgKyBwQ21kXG4gICAgICA6IHBDbWRcblxuICAgIHJlc29sdmUoc3ViU3RlcChwLCBpLCAwKSlcbiAgfSlcblxuICBjb25zdCBzdWJTdGVwID0gKHAsIGksIGlpKSA9PiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgaWYgKGlpID09PSBwYXRoRXh0Lmxlbmd0aClcbiAgICAgIHJldHVybiByZXNvbHZlKHN0ZXAoaSArIDEpKVxuICAgIGNvbnN0IGV4dCA9IHBhdGhFeHRbaWldXG4gICAgaXNleGUocCArIGV4dCwgeyBwYXRoRXh0OiBwYXRoRXh0RXhlIH0sIChlciwgaXMpID0+IHtcbiAgICAgIGlmICghZXIgJiYgaXMpIHtcbiAgICAgICAgaWYgKG9wdC5hbGwpXG4gICAgICAgICAgZm91bmQucHVzaChwICsgZXh0KVxuICAgICAgICBlbHNlXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUocCArIGV4dClcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXNvbHZlKHN1YlN0ZXAocCwgaSwgaWkgKyAxKSlcbiAgICB9KVxuICB9KVxuXG4gIHJldHVybiBjYiA/IHN0ZXAoMCkudGhlbihyZXMgPT4gY2IobnVsbCwgcmVzKSwgY2IpIDogc3RlcCgwKVxufVxuXG5jb25zdCB3aGljaFN5bmMgPSAoY21kLCBvcHQpID0+IHtcbiAgb3B0ID0gb3B0IHx8IHt9XG5cbiAgY29uc3QgeyBwYXRoRW52LCBwYXRoRXh0LCBwYXRoRXh0RXhlIH0gPSBnZXRQYXRoSW5mbyhjbWQsIG9wdClcbiAgY29uc3QgZm91bmQgPSBbXVxuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0aEVudi5sZW5ndGg7IGkgKyspIHtcbiAgICBjb25zdCBwcFJhdyA9IHBhdGhFbnZbaV1cbiAgICBjb25zdCBwYXRoUGFydCA9IC9eXCIuKlwiJC8udGVzdChwcFJhdykgPyBwcFJhdy5zbGljZSgxLCAtMSkgOiBwcFJhd1xuXG4gICAgY29uc3QgcENtZCA9IHBhdGguam9pbihwYXRoUGFydCwgY21kKVxuICAgIGNvbnN0IHAgPSAhcGF0aFBhcnQgJiYgL15cXC5bXFxcXFxcL10vLnRlc3QoY21kKSA/IGNtZC5zbGljZSgwLCAyKSArIHBDbWRcbiAgICAgIDogcENtZFxuXG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBwYXRoRXh0Lmxlbmd0aDsgaiArKykge1xuICAgICAgY29uc3QgY3VyID0gcCArIHBhdGhFeHRbal1cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGlzID0gaXNleGUuc3luYyhjdXIsIHsgcGF0aEV4dDogcGF0aEV4dEV4ZSB9KVxuICAgICAgICBpZiAoaXMpIHtcbiAgICAgICAgICBpZiAob3B0LmFsbClcbiAgICAgICAgICAgIGZvdW5kLnB1c2goY3VyKVxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJldHVybiBjdXJcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXgpIHt9XG4gICAgfVxuICB9XG5cbiAgaWYgKG9wdC5hbGwgJiYgZm91bmQubGVuZ3RoKVxuICAgIHJldHVybiBmb3VuZFxuXG4gIGlmIChvcHQubm90aHJvdylcbiAgICByZXR1cm4gbnVsbFxuXG4gIHRocm93IGdldE5vdEZvdW5kRXJyb3IoY21kKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHdoaWNoXG53aGljaC5zeW5jID0gd2hpY2hTeW5jXG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IHBhdGhLZXkgPSAob3B0aW9ucyA9IHt9KSA9PiB7XG5cdGNvbnN0IGVudmlyb25tZW50ID0gb3B0aW9ucy5lbnYgfHwgcHJvY2Vzcy5lbnY7XG5cdGNvbnN0IHBsYXRmb3JtID0gb3B0aW9ucy5wbGF0Zm9ybSB8fCBwcm9jZXNzLnBsYXRmb3JtO1xuXG5cdGlmIChwbGF0Zm9ybSAhPT0gJ3dpbjMyJykge1xuXHRcdHJldHVybiAnUEFUSCc7XG5cdH1cblxuXHRyZXR1cm4gT2JqZWN0LmtleXMoZW52aXJvbm1lbnQpLnJldmVyc2UoKS5maW5kKGtleSA9PiBrZXkudG9VcHBlckNhc2UoKSA9PT0gJ1BBVEgnKSB8fCAnUGF0aCc7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHBhdGhLZXk7XG4vLyBUT0RPOiBSZW1vdmUgdGhpcyBmb3IgdGhlIG5leHQgbWFqb3IgcmVsZWFzZVxubW9kdWxlLmV4cG9ydHMuZGVmYXVsdCA9IHBhdGhLZXk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IHBhdGggPSByZXF1aXJlKCdwYXRoJyk7XG5jb25zdCB3aGljaCA9IHJlcXVpcmUoJ3doaWNoJyk7XG5jb25zdCBnZXRQYXRoS2V5ID0gcmVxdWlyZSgncGF0aC1rZXknKTtcblxuZnVuY3Rpb24gcmVzb2x2ZUNvbW1hbmRBdHRlbXB0KHBhcnNlZCwgd2l0aG91dFBhdGhFeHQpIHtcbiAgICBjb25zdCBlbnYgPSBwYXJzZWQub3B0aW9ucy5lbnYgfHwgcHJvY2Vzcy5lbnY7XG4gICAgY29uc3QgY3dkID0gcHJvY2Vzcy5jd2QoKTtcbiAgICBjb25zdCBoYXNDdXN0b21Dd2QgPSBwYXJzZWQub3B0aW9ucy5jd2QgIT0gbnVsbDtcbiAgICAvLyBXb3JrZXIgdGhyZWFkcyBkbyBub3QgaGF2ZSBwcm9jZXNzLmNoZGlyKClcbiAgICBjb25zdCBzaG91bGRTd2l0Y2hDd2QgPSBoYXNDdXN0b21Dd2QgJiYgcHJvY2Vzcy5jaGRpciAhPT0gdW5kZWZpbmVkICYmICFwcm9jZXNzLmNoZGlyLmRpc2FibGVkO1xuXG4gICAgLy8gSWYgYSBjdXN0b20gYGN3ZGAgd2FzIHNwZWNpZmllZCwgd2UgbmVlZCB0byBjaGFuZ2UgdGhlIHByb2Nlc3MgY3dkXG4gICAgLy8gYmVjYXVzZSBgd2hpY2hgIHdpbGwgZG8gc3RhdCBjYWxscyBidXQgZG9lcyBub3Qgc3VwcG9ydCBhIGN1c3RvbSBjd2RcbiAgICBpZiAoc2hvdWxkU3dpdGNoQ3dkKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBwcm9jZXNzLmNoZGlyKHBhcnNlZC5vcHRpb25zLmN3ZCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgLyogRW1wdHkgKi9cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxldCByZXNvbHZlZDtcblxuICAgIHRyeSB7XG4gICAgICAgIHJlc29sdmVkID0gd2hpY2guc3luYyhwYXJzZWQuY29tbWFuZCwge1xuICAgICAgICAgICAgcGF0aDogZW52W2dldFBhdGhLZXkoeyBlbnYgfSldLFxuICAgICAgICAgICAgcGF0aEV4dDogd2l0aG91dFBhdGhFeHQgPyBwYXRoLmRlbGltaXRlciA6IHVuZGVmaW5lZCxcbiAgICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvKiBFbXB0eSAqL1xuICAgIH0gZmluYWxseSB7XG4gICAgICAgIGlmIChzaG91bGRTd2l0Y2hDd2QpIHtcbiAgICAgICAgICAgIHByb2Nlc3MuY2hkaXIoY3dkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIHdlIHN1Y2Nlc3NmdWxseSByZXNvbHZlZCwgZW5zdXJlIHRoYXQgYW4gYWJzb2x1dGUgcGF0aCBpcyByZXR1cm5lZFxuICAgIC8vIE5vdGUgdGhhdCB3aGVuIGEgY3VzdG9tIGBjd2RgIHdhcyB1c2VkLCB3ZSBuZWVkIHRvIHJlc29sdmUgdG8gYW4gYWJzb2x1dGUgcGF0aCBiYXNlZCBvbiBpdFxuICAgIGlmIChyZXNvbHZlZCkge1xuICAgICAgICByZXNvbHZlZCA9IHBhdGgucmVzb2x2ZShoYXNDdXN0b21Dd2QgPyBwYXJzZWQub3B0aW9ucy5jd2QgOiAnJywgcmVzb2x2ZWQpO1xuICAgIH1cblxuICAgIHJldHVybiByZXNvbHZlZDtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUNvbW1hbmQocGFyc2VkKSB7XG4gICAgcmV0dXJuIHJlc29sdmVDb21tYW5kQXR0ZW1wdChwYXJzZWQpIHx8IHJlc29sdmVDb21tYW5kQXR0ZW1wdChwYXJzZWQsIHRydWUpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlc29sdmVDb21tYW5kO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBTZWUgaHR0cDovL3d3dy5yb2J2YW5kZXJ3b3VkZS5jb20vZXNjYXBlY2hhcnMucGhwXG5jb25zdCBtZXRhQ2hhcnNSZWdFeHAgPSAvKFsoKVxcXVslIV5cImA8PiZ8OywgKj9dKS9nO1xuXG5mdW5jdGlvbiBlc2NhcGVDb21tYW5kKGFyZykge1xuICAgIC8vIEVzY2FwZSBtZXRhIGNoYXJzXG4gICAgYXJnID0gYXJnLnJlcGxhY2UobWV0YUNoYXJzUmVnRXhwLCAnXiQxJyk7XG5cbiAgICByZXR1cm4gYXJnO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVBcmd1bWVudChhcmcsIGRvdWJsZUVzY2FwZU1ldGFDaGFycykge1xuICAgIC8vIENvbnZlcnQgdG8gc3RyaW5nXG4gICAgYXJnID0gYCR7YXJnfWA7XG5cbiAgICAvLyBBbGdvcml0aG0gYmVsb3cgaXMgYmFzZWQgb24gaHR0cHM6Ly9xbnRtLm9yZy9jbWRcblxuICAgIC8vIFNlcXVlbmNlIG9mIGJhY2tzbGFzaGVzIGZvbGxvd2VkIGJ5IGEgZG91YmxlIHF1b3RlOlxuICAgIC8vIGRvdWJsZSB1cCBhbGwgdGhlIGJhY2tzbGFzaGVzIGFuZCBlc2NhcGUgdGhlIGRvdWJsZSBxdW90ZVxuICAgIGFyZyA9IGFyZy5yZXBsYWNlKC8oXFxcXCopXCIvZywgJyQxJDFcXFxcXCInKTtcblxuICAgIC8vIFNlcXVlbmNlIG9mIGJhY2tzbGFzaGVzIGZvbGxvd2VkIGJ5IHRoZSBlbmQgb2YgdGhlIHN0cmluZ1xuICAgIC8vICh3aGljaCB3aWxsIGJlY29tZSBhIGRvdWJsZSBxdW90ZSBsYXRlcik6XG4gICAgLy8gZG91YmxlIHVwIGFsbCB0aGUgYmFja3NsYXNoZXNcbiAgICBhcmcgPSBhcmcucmVwbGFjZSgvKFxcXFwqKSQvLCAnJDEkMScpO1xuXG4gICAgLy8gQWxsIG90aGVyIGJhY2tzbGFzaGVzIG9jY3VyIGxpdGVyYWxseVxuXG4gICAgLy8gUXVvdGUgdGhlIHdob2xlIHRoaW5nOlxuICAgIGFyZyA9IGBcIiR7YXJnfVwiYDtcblxuICAgIC8vIEVzY2FwZSBtZXRhIGNoYXJzXG4gICAgYXJnID0gYXJnLnJlcGxhY2UobWV0YUNoYXJzUmVnRXhwLCAnXiQxJyk7XG5cbiAgICAvLyBEb3VibGUgZXNjYXBlIG1ldGEgY2hhcnMgaWYgbmVjZXNzYXJ5XG4gICAgaWYgKGRvdWJsZUVzY2FwZU1ldGFDaGFycykge1xuICAgICAgICBhcmcgPSBhcmcucmVwbGFjZShtZXRhQ2hhcnNSZWdFeHAsICdeJDEnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXJnO1xufVxuXG5tb2R1bGUuZXhwb3J0cy5jb21tYW5kID0gZXNjYXBlQ29tbWFuZDtcbm1vZHVsZS5leHBvcnRzLmFyZ3VtZW50ID0gZXNjYXBlQXJndW1lbnQ7XG4iLCIndXNlIHN0cmljdCc7XG5tb2R1bGUuZXhwb3J0cyA9IC9eIyEoLiopLztcbiIsIid1c2Ugc3RyaWN0JztcbmNvbnN0IHNoZWJhbmdSZWdleCA9IHJlcXVpcmUoJ3NoZWJhbmctcmVnZXgnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoc3RyaW5nID0gJycpID0+IHtcblx0Y29uc3QgbWF0Y2ggPSBzdHJpbmcubWF0Y2goc2hlYmFuZ1JlZ2V4KTtcblxuXHRpZiAoIW1hdGNoKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBbcGF0aCwgYXJndW1lbnRdID0gbWF0Y2hbMF0ucmVwbGFjZSgvIyEgPy8sICcnKS5zcGxpdCgnICcpO1xuXHRjb25zdCBiaW5hcnkgPSBwYXRoLnNwbGl0KCcvJykucG9wKCk7XG5cblx0aWYgKGJpbmFyeSA9PT0gJ2VudicpIHtcblx0XHRyZXR1cm4gYXJndW1lbnQ7XG5cdH1cblxuXHRyZXR1cm4gYXJndW1lbnQgPyBgJHtiaW5hcnl9ICR7YXJndW1lbnR9YCA6IGJpbmFyeTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGZzID0gcmVxdWlyZSgnZnMnKTtcbmNvbnN0IHNoZWJhbmdDb21tYW5kID0gcmVxdWlyZSgnc2hlYmFuZy1jb21tYW5kJyk7XG5cbmZ1bmN0aW9uIHJlYWRTaGViYW5nKGNvbW1hbmQpIHtcbiAgICAvLyBSZWFkIHRoZSBmaXJzdCAxNTAgYnl0ZXMgZnJvbSB0aGUgZmlsZVxuICAgIGNvbnN0IHNpemUgPSAxNTA7XG4gICAgY29uc3QgYnVmZmVyID0gQnVmZmVyLmFsbG9jKHNpemUpO1xuXG4gICAgbGV0IGZkO1xuXG4gICAgdHJ5IHtcbiAgICAgICAgZmQgPSBmcy5vcGVuU3luYyhjb21tYW5kLCAncicpO1xuICAgICAgICBmcy5yZWFkU3luYyhmZCwgYnVmZmVyLCAwLCBzaXplLCAwKTtcbiAgICAgICAgZnMuY2xvc2VTeW5jKGZkKTtcbiAgICB9IGNhdGNoIChlKSB7IC8qIEVtcHR5ICovIH1cblxuICAgIC8vIEF0dGVtcHQgdG8gZXh0cmFjdCBzaGViYW5nIChudWxsIGlzIHJldHVybmVkIGlmIG5vdCBhIHNoZWJhbmcpXG4gICAgcmV0dXJuIHNoZWJhbmdDb21tYW5kKGJ1ZmZlci50b1N0cmluZygpKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSByZWFkU2hlYmFuZztcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKTtcbmNvbnN0IHJlc29sdmVDb21tYW5kID0gcmVxdWlyZSgnLi91dGlsL3Jlc29sdmVDb21tYW5kJyk7XG5jb25zdCBlc2NhcGUgPSByZXF1aXJlKCcuL3V0aWwvZXNjYXBlJyk7XG5jb25zdCByZWFkU2hlYmFuZyA9IHJlcXVpcmUoJy4vdXRpbC9yZWFkU2hlYmFuZycpO1xuXG5jb25zdCBpc1dpbiA9IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMic7XG5jb25zdCBpc0V4ZWN1dGFibGVSZWdFeHAgPSAvXFwuKD86Y29tfGV4ZSkkL2k7XG5jb25zdCBpc0NtZFNoaW1SZWdFeHAgPSAvbm9kZV9tb2R1bGVzW1xcXFwvXS5iaW5bXFxcXC9dW15cXFxcL10rXFwuY21kJC9pO1xuXG5mdW5jdGlvbiBkZXRlY3RTaGViYW5nKHBhcnNlZCkge1xuICAgIHBhcnNlZC5maWxlID0gcmVzb2x2ZUNvbW1hbmQocGFyc2VkKTtcblxuICAgIGNvbnN0IHNoZWJhbmcgPSBwYXJzZWQuZmlsZSAmJiByZWFkU2hlYmFuZyhwYXJzZWQuZmlsZSk7XG5cbiAgICBpZiAoc2hlYmFuZykge1xuICAgICAgICBwYXJzZWQuYXJncy51bnNoaWZ0KHBhcnNlZC5maWxlKTtcbiAgICAgICAgcGFyc2VkLmNvbW1hbmQgPSBzaGViYW5nO1xuXG4gICAgICAgIHJldHVybiByZXNvbHZlQ29tbWFuZChwYXJzZWQpO1xuICAgIH1cblxuICAgIHJldHVybiBwYXJzZWQuZmlsZTtcbn1cblxuZnVuY3Rpb24gcGFyc2VOb25TaGVsbChwYXJzZWQpIHtcbiAgICBpZiAoIWlzV2luKSB7XG4gICAgICAgIHJldHVybiBwYXJzZWQ7XG4gICAgfVxuXG4gICAgLy8gRGV0ZWN0ICYgYWRkIHN1cHBvcnQgZm9yIHNoZWJhbmdzXG4gICAgY29uc3QgY29tbWFuZEZpbGUgPSBkZXRlY3RTaGViYW5nKHBhcnNlZCk7XG5cbiAgICAvLyBXZSBkb24ndCBuZWVkIGEgc2hlbGwgaWYgdGhlIGNvbW1hbmQgZmlsZW5hbWUgaXMgYW4gZXhlY3V0YWJsZVxuICAgIGNvbnN0IG5lZWRzU2hlbGwgPSAhaXNFeGVjdXRhYmxlUmVnRXhwLnRlc3QoY29tbWFuZEZpbGUpO1xuXG4gICAgLy8gSWYgYSBzaGVsbCBpcyByZXF1aXJlZCwgdXNlIGNtZC5leGUgYW5kIHRha2UgY2FyZSBvZiBlc2NhcGluZyBldmVyeXRoaW5nIGNvcnJlY3RseVxuICAgIC8vIE5vdGUgdGhhdCBgZm9yY2VTaGVsbGAgaXMgYW4gaGlkZGVuIG9wdGlvbiB1c2VkIG9ubHkgaW4gdGVzdHNcbiAgICBpZiAocGFyc2VkLm9wdGlvbnMuZm9yY2VTaGVsbCB8fCBuZWVkc1NoZWxsKSB7XG4gICAgICAgIC8vIE5lZWQgdG8gZG91YmxlIGVzY2FwZSBtZXRhIGNoYXJzIGlmIHRoZSBjb21tYW5kIGlzIGEgY21kLXNoaW0gbG9jYXRlZCBpbiBgbm9kZV9tb2R1bGVzLy5iaW4vYFxuICAgICAgICAvLyBUaGUgY21kLXNoaW0gc2ltcGx5IGNhbGxzIGV4ZWN1dGUgdGhlIHBhY2thZ2UgYmluIGZpbGUgd2l0aCBOb2RlSlMsIHByb3h5aW5nIGFueSBhcmd1bWVudFxuICAgICAgICAvLyBCZWNhdXNlIHRoZSBlc2NhcGUgb2YgbWV0YWNoYXJzIHdpdGggXiBnZXRzIGludGVycHJldGVkIHdoZW4gdGhlIGNtZC5leGUgaXMgZmlyc3QgY2FsbGVkLFxuICAgICAgICAvLyB3ZSBuZWVkIHRvIGRvdWJsZSBlc2NhcGUgdGhlbVxuICAgICAgICBjb25zdCBuZWVkc0RvdWJsZUVzY2FwZU1ldGFDaGFycyA9IGlzQ21kU2hpbVJlZ0V4cC50ZXN0KGNvbW1hbmRGaWxlKTtcblxuICAgICAgICAvLyBOb3JtYWxpemUgcG9zaXggcGF0aHMgaW50byBPUyBjb21wYXRpYmxlIHBhdGhzIChlLmcuOiBmb28vYmFyIC0+IGZvb1xcYmFyKVxuICAgICAgICAvLyBUaGlzIGlzIG5lY2Vzc2FyeSBvdGhlcndpc2UgaXQgd2lsbCBhbHdheXMgZmFpbCB3aXRoIEVOT0VOVCBpbiB0aG9zZSBjYXNlc1xuICAgICAgICBwYXJzZWQuY29tbWFuZCA9IHBhdGgubm9ybWFsaXplKHBhcnNlZC5jb21tYW5kKTtcblxuICAgICAgICAvLyBFc2NhcGUgY29tbWFuZCAmIGFyZ3VtZW50c1xuICAgICAgICBwYXJzZWQuY29tbWFuZCA9IGVzY2FwZS5jb21tYW5kKHBhcnNlZC5jb21tYW5kKTtcbiAgICAgICAgcGFyc2VkLmFyZ3MgPSBwYXJzZWQuYXJncy5tYXAoKGFyZykgPT4gZXNjYXBlLmFyZ3VtZW50KGFyZywgbmVlZHNEb3VibGVFc2NhcGVNZXRhQ2hhcnMpKTtcblxuICAgICAgICBjb25zdCBzaGVsbENvbW1hbmQgPSBbcGFyc2VkLmNvbW1hbmRdLmNvbmNhdChwYXJzZWQuYXJncykuam9pbignICcpO1xuXG4gICAgICAgIHBhcnNlZC5hcmdzID0gWycvZCcsICcvcycsICcvYycsIGBcIiR7c2hlbGxDb21tYW5kfVwiYF07XG4gICAgICAgIHBhcnNlZC5jb21tYW5kID0gcHJvY2Vzcy5lbnYuY29tc3BlYyB8fCAnY21kLmV4ZSc7XG4gICAgICAgIHBhcnNlZC5vcHRpb25zLndpbmRvd3NWZXJiYXRpbUFyZ3VtZW50cyA9IHRydWU7IC8vIFRlbGwgbm9kZSdzIHNwYXduIHRoYXQgdGhlIGFyZ3VtZW50cyBhcmUgYWxyZWFkeSBlc2NhcGVkXG4gICAgfVxuXG4gICAgcmV0dXJuIHBhcnNlZDtcbn1cblxuZnVuY3Rpb24gcGFyc2UoY29tbWFuZCwgYXJncywgb3B0aW9ucykge1xuICAgIC8vIE5vcm1hbGl6ZSBhcmd1bWVudHMsIHNpbWlsYXIgdG8gbm9kZWpzXG4gICAgaWYgKGFyZ3MgJiYgIUFycmF5LmlzQXJyYXkoYXJncykpIHtcbiAgICAgICAgb3B0aW9ucyA9IGFyZ3M7XG4gICAgICAgIGFyZ3MgPSBudWxsO1xuICAgIH1cblxuICAgIGFyZ3MgPSBhcmdzID8gYXJncy5zbGljZSgwKSA6IFtdOyAvLyBDbG9uZSBhcnJheSB0byBhdm9pZCBjaGFuZ2luZyB0aGUgb3JpZ2luYWxcbiAgICBvcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucyk7IC8vIENsb25lIG9iamVjdCB0byBhdm9pZCBjaGFuZ2luZyB0aGUgb3JpZ2luYWxcblxuICAgIC8vIEJ1aWxkIG91ciBwYXJzZWQgb2JqZWN0XG4gICAgY29uc3QgcGFyc2VkID0ge1xuICAgICAgICBjb21tYW5kLFxuICAgICAgICBhcmdzLFxuICAgICAgICBvcHRpb25zLFxuICAgICAgICBmaWxlOiB1bmRlZmluZWQsXG4gICAgICAgIG9yaWdpbmFsOiB7XG4gICAgICAgICAgICBjb21tYW5kLFxuICAgICAgICAgICAgYXJncyxcbiAgICAgICAgfSxcbiAgICB9O1xuXG4gICAgLy8gRGVsZWdhdGUgZnVydGhlciBwYXJzaW5nIHRvIHNoZWxsIG9yIG5vbi1zaGVsbFxuICAgIHJldHVybiBvcHRpb25zLnNoZWxsID8gcGFyc2VkIDogcGFyc2VOb25TaGVsbChwYXJzZWQpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBpc1dpbiA9IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMic7XG5cbmZ1bmN0aW9uIG5vdEZvdW5kRXJyb3Iob3JpZ2luYWwsIHN5c2NhbGwpIHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihuZXcgRXJyb3IoYCR7c3lzY2FsbH0gJHtvcmlnaW5hbC5jb21tYW5kfSBFTk9FTlRgKSwge1xuICAgICAgICBjb2RlOiAnRU5PRU5UJyxcbiAgICAgICAgZXJybm86ICdFTk9FTlQnLFxuICAgICAgICBzeXNjYWxsOiBgJHtzeXNjYWxsfSAke29yaWdpbmFsLmNvbW1hbmR9YCxcbiAgICAgICAgcGF0aDogb3JpZ2luYWwuY29tbWFuZCxcbiAgICAgICAgc3Bhd25hcmdzOiBvcmlnaW5hbC5hcmdzLFxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBob29rQ2hpbGRQcm9jZXNzKGNwLCBwYXJzZWQpIHtcbiAgICBpZiAoIWlzV2luKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBvcmlnaW5hbEVtaXQgPSBjcC5lbWl0O1xuXG4gICAgY3AuZW1pdCA9IGZ1bmN0aW9uIChuYW1lLCBhcmcxKSB7XG4gICAgICAgIC8vIElmIGVtaXR0aW5nIFwiZXhpdFwiIGV2ZW50IGFuZCBleGl0IGNvZGUgaXMgMSwgd2UgbmVlZCB0byBjaGVjayBpZlxuICAgICAgICAvLyB0aGUgY29tbWFuZCBleGlzdHMgYW5kIGVtaXQgYW4gXCJlcnJvclwiIGluc3RlYWRcbiAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9JbmRpZ29Vbml0ZWQvbm9kZS1jcm9zcy1zcGF3bi9pc3N1ZXMvMTZcbiAgICAgICAgaWYgKG5hbWUgPT09ICdleGl0Jykge1xuICAgICAgICAgICAgY29uc3QgZXJyID0gdmVyaWZ5RU5PRU5UKGFyZzEsIHBhcnNlZCwgJ3NwYXduJyk7XG5cbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb3JpZ2luYWxFbWl0LmNhbGwoY3AsICdlcnJvcicsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3JpZ2luYWxFbWl0LmFwcGx5KGNwLCBhcmd1bWVudHMpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIHByZWZlci1yZXN0LXBhcmFtc1xuICAgIH07XG59XG5cbmZ1bmN0aW9uIHZlcmlmeUVOT0VOVChzdGF0dXMsIHBhcnNlZCkge1xuICAgIGlmIChpc1dpbiAmJiBzdGF0dXMgPT09IDEgJiYgIXBhcnNlZC5maWxlKSB7XG4gICAgICAgIHJldHVybiBub3RGb3VuZEVycm9yKHBhcnNlZC5vcmlnaW5hbCwgJ3NwYXduJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIHZlcmlmeUVOT0VOVFN5bmMoc3RhdHVzLCBwYXJzZWQpIHtcbiAgICBpZiAoaXNXaW4gJiYgc3RhdHVzID09PSAxICYmICFwYXJzZWQuZmlsZSkge1xuICAgICAgICByZXR1cm4gbm90Rm91bmRFcnJvcihwYXJzZWQub3JpZ2luYWwsICdzcGF3blN5bmMnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgaG9va0NoaWxkUHJvY2VzcyxcbiAgICB2ZXJpZnlFTk9FTlQsXG4gICAgdmVyaWZ5RU5PRU5UU3luYyxcbiAgICBub3RGb3VuZEVycm9yLFxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgY3AgPSByZXF1aXJlKCdjaGlsZF9wcm9jZXNzJyk7XG5jb25zdCBwYXJzZSA9IHJlcXVpcmUoJy4vbGliL3BhcnNlJyk7XG5jb25zdCBlbm9lbnQgPSByZXF1aXJlKCcuL2xpYi9lbm9lbnQnKTtcblxuZnVuY3Rpb24gc3Bhd24oY29tbWFuZCwgYXJncywgb3B0aW9ucykge1xuICAgIC8vIFBhcnNlIHRoZSBhcmd1bWVudHNcbiAgICBjb25zdCBwYXJzZWQgPSBwYXJzZShjb21tYW5kLCBhcmdzLCBvcHRpb25zKTtcblxuICAgIC8vIFNwYXduIHRoZSBjaGlsZCBwcm9jZXNzXG4gICAgY29uc3Qgc3Bhd25lZCA9IGNwLnNwYXduKHBhcnNlZC5jb21tYW5kLCBwYXJzZWQuYXJncywgcGFyc2VkLm9wdGlvbnMpO1xuXG4gICAgLy8gSG9vayBpbnRvIGNoaWxkIHByb2Nlc3MgXCJleGl0XCIgZXZlbnQgdG8gZW1pdCBhbiBlcnJvciBpZiB0aGUgY29tbWFuZFxuICAgIC8vIGRvZXMgbm90IGV4aXN0cywgc2VlOiBodHRwczovL2dpdGh1Yi5jb20vSW5kaWdvVW5pdGVkL25vZGUtY3Jvc3Mtc3Bhd24vaXNzdWVzLzE2XG4gICAgZW5vZW50Lmhvb2tDaGlsZFByb2Nlc3Moc3Bhd25lZCwgcGFyc2VkKTtcblxuICAgIHJldHVybiBzcGF3bmVkO1xufVxuXG5mdW5jdGlvbiBzcGF3blN5bmMoY29tbWFuZCwgYXJncywgb3B0aW9ucykge1xuICAgIC8vIFBhcnNlIHRoZSBhcmd1bWVudHNcbiAgICBjb25zdCBwYXJzZWQgPSBwYXJzZShjb21tYW5kLCBhcmdzLCBvcHRpb25zKTtcblxuICAgIC8vIFNwYXduIHRoZSBjaGlsZCBwcm9jZXNzXG4gICAgY29uc3QgcmVzdWx0ID0gY3Auc3Bhd25TeW5jKHBhcnNlZC5jb21tYW5kLCBwYXJzZWQuYXJncywgcGFyc2VkLm9wdGlvbnMpO1xuXG4gICAgLy8gQW5hbHl6ZSBpZiB0aGUgY29tbWFuZCBkb2VzIG5vdCBleGlzdCwgc2VlOiBodHRwczovL2dpdGh1Yi5jb20vSW5kaWdvVW5pdGVkL25vZGUtY3Jvc3Mtc3Bhd24vaXNzdWVzLzE2XG4gICAgcmVzdWx0LmVycm9yID0gcmVzdWx0LmVycm9yIHx8IGVub2VudC52ZXJpZnlFTk9FTlRTeW5jKHJlc3VsdC5zdGF0dXMsIHBhcnNlZCk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNwYXduO1xubW9kdWxlLmV4cG9ydHMuc3Bhd24gPSBzcGF3bjtcbm1vZHVsZS5leHBvcnRzLnN5bmMgPSBzcGF3blN5bmM7XG5cbm1vZHVsZS5leHBvcnRzLl9wYXJzZSA9IHBhcnNlO1xubW9kdWxlLmV4cG9ydHMuX2Vub2VudCA9IGVub2VudDtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBpbnB1dCA9PiB7XG5cdGNvbnN0IExGID0gdHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJyA/ICdcXG4nIDogJ1xcbicuY2hhckNvZGVBdCgpO1xuXHRjb25zdCBDUiA9IHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycgPyAnXFxyJyA6ICdcXHInLmNoYXJDb2RlQXQoKTtcblxuXHRpZiAoaW5wdXRbaW5wdXQubGVuZ3RoIC0gMV0gPT09IExGKSB7XG5cdFx0aW5wdXQgPSBpbnB1dC5zbGljZSgwLCBpbnB1dC5sZW5ndGggLSAxKTtcblx0fVxuXG5cdGlmIChpbnB1dFtpbnB1dC5sZW5ndGggLSAxXSA9PT0gQ1IpIHtcblx0XHRpbnB1dCA9IGlucHV0LnNsaWNlKDAsIGlucHV0Lmxlbmd0aCAtIDEpO1xuXHR9XG5cblx0cmV0dXJuIGlucHV0O1xufTtcbiIsIid1c2Ugc3RyaWN0JztcbmNvbnN0IHBhdGggPSByZXF1aXJlKCdwYXRoJyk7XG5jb25zdCBwYXRoS2V5ID0gcmVxdWlyZSgncGF0aC1rZXknKTtcblxuY29uc3QgbnBtUnVuUGF0aCA9IG9wdGlvbnMgPT4ge1xuXHRvcHRpb25zID0ge1xuXHRcdGN3ZDogcHJvY2Vzcy5jd2QoKSxcblx0XHRwYXRoOiBwcm9jZXNzLmVudltwYXRoS2V5KCldLFxuXHRcdGV4ZWNQYXRoOiBwcm9jZXNzLmV4ZWNQYXRoLFxuXHRcdC4uLm9wdGlvbnNcblx0fTtcblxuXHRsZXQgcHJldmlvdXM7XG5cdGxldCBjd2RQYXRoID0gcGF0aC5yZXNvbHZlKG9wdGlvbnMuY3dkKTtcblx0Y29uc3QgcmVzdWx0ID0gW107XG5cblx0d2hpbGUgKHByZXZpb3VzICE9PSBjd2RQYXRoKSB7XG5cdFx0cmVzdWx0LnB1c2gocGF0aC5qb2luKGN3ZFBhdGgsICdub2RlX21vZHVsZXMvLmJpbicpKTtcblx0XHRwcmV2aW91cyA9IGN3ZFBhdGg7XG5cdFx0Y3dkUGF0aCA9IHBhdGgucmVzb2x2ZShjd2RQYXRoLCAnLi4nKTtcblx0fVxuXG5cdC8vIEVuc3VyZSB0aGUgcnVubmluZyBgbm9kZWAgYmluYXJ5IGlzIHVzZWRcblx0Y29uc3QgZXhlY1BhdGhEaXIgPSBwYXRoLnJlc29sdmUob3B0aW9ucy5jd2QsIG9wdGlvbnMuZXhlY1BhdGgsICcuLicpO1xuXHRyZXN1bHQucHVzaChleGVjUGF0aERpcik7XG5cblx0cmV0dXJuIHJlc3VsdC5jb25jYXQob3B0aW9ucy5wYXRoKS5qb2luKHBhdGguZGVsaW1pdGVyKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbnBtUnVuUGF0aDtcbi8vIFRPRE86IFJlbW92ZSB0aGlzIGZvciB0aGUgbmV4dCBtYWpvciByZWxlYXNlXG5tb2R1bGUuZXhwb3J0cy5kZWZhdWx0ID0gbnBtUnVuUGF0aDtcblxubW9kdWxlLmV4cG9ydHMuZW52ID0gb3B0aW9ucyA9PiB7XG5cdG9wdGlvbnMgPSB7XG5cdFx0ZW52OiBwcm9jZXNzLmVudixcblx0XHQuLi5vcHRpb25zXG5cdH07XG5cblx0Y29uc3QgZW52ID0gey4uLm9wdGlvbnMuZW52fTtcblx0Y29uc3QgcGF0aCA9IHBhdGhLZXkoe2Vudn0pO1xuXG5cdG9wdGlvbnMucGF0aCA9IGVudltwYXRoXTtcblx0ZW52W3BhdGhdID0gbW9kdWxlLmV4cG9ydHMob3B0aW9ucyk7XG5cblx0cmV0dXJuIGVudjtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IG1pbWljRm4gPSAodG8sIGZyb20pID0+IHtcblx0Zm9yIChjb25zdCBwcm9wIG9mIFJlZmxlY3Qub3duS2V5cyhmcm9tKSkge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0bywgcHJvcCwgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihmcm9tLCBwcm9wKSk7XG5cdH1cblxuXHRyZXR1cm4gdG87XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG1pbWljRm47XG4vLyBUT0RPOiBSZW1vdmUgdGhpcyBmb3IgdGhlIG5leHQgbWFqb3IgcmVsZWFzZVxubW9kdWxlLmV4cG9ydHMuZGVmYXVsdCA9IG1pbWljRm47XG4iLCIndXNlIHN0cmljdCc7XG5jb25zdCBtaW1pY0ZuID0gcmVxdWlyZSgnbWltaWMtZm4nKTtcblxuY29uc3QgY2FsbGVkRnVuY3Rpb25zID0gbmV3IFdlYWtNYXAoKTtcblxuY29uc3Qgb25ldGltZSA9IChmdW5jdGlvbl8sIG9wdGlvbnMgPSB7fSkgPT4ge1xuXHRpZiAodHlwZW9mIGZ1bmN0aW9uXyAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIGEgZnVuY3Rpb24nKTtcblx0fVxuXG5cdGxldCByZXR1cm5WYWx1ZTtcblx0bGV0IGNhbGxDb3VudCA9IDA7XG5cdGNvbnN0IGZ1bmN0aW9uTmFtZSA9IGZ1bmN0aW9uXy5kaXNwbGF5TmFtZSB8fCBmdW5jdGlvbl8ubmFtZSB8fCAnPGFub255bW91cz4nO1xuXG5cdGNvbnN0IG9uZXRpbWUgPSBmdW5jdGlvbiAoLi4uYXJndW1lbnRzXykge1xuXHRcdGNhbGxlZEZ1bmN0aW9ucy5zZXQob25ldGltZSwgKytjYWxsQ291bnQpO1xuXG5cdFx0aWYgKGNhbGxDb3VudCA9PT0gMSkge1xuXHRcdFx0cmV0dXJuVmFsdWUgPSBmdW5jdGlvbl8uYXBwbHkodGhpcywgYXJndW1lbnRzXyk7XG5cdFx0XHRmdW5jdGlvbl8gPSBudWxsO1xuXHRcdH0gZWxzZSBpZiAob3B0aW9ucy50aHJvdyA9PT0gdHJ1ZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBGdW5jdGlvbiBcXGAke2Z1bmN0aW9uTmFtZX1cXGAgY2FuIG9ubHkgYmUgY2FsbGVkIG9uY2VgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmV0dXJuVmFsdWU7XG5cdH07XG5cblx0bWltaWNGbihvbmV0aW1lLCBmdW5jdGlvbl8pO1xuXHRjYWxsZWRGdW5jdGlvbnMuc2V0KG9uZXRpbWUsIGNhbGxDb3VudCk7XG5cblx0cmV0dXJuIG9uZXRpbWU7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG9uZXRpbWU7XG4vLyBUT0RPOiBSZW1vdmUgdGhpcyBmb3IgdGhlIG5leHQgbWFqb3IgcmVsZWFzZVxubW9kdWxlLmV4cG9ydHMuZGVmYXVsdCA9IG9uZXRpbWU7XG5cbm1vZHVsZS5leHBvcnRzLmNhbGxDb3VudCA9IGZ1bmN0aW9uXyA9PiB7XG5cdGlmICghY2FsbGVkRnVuY3Rpb25zLmhhcyhmdW5jdGlvbl8pKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBUaGUgZ2l2ZW4gZnVuY3Rpb24gXFxgJHtmdW5jdGlvbl8ubmFtZX1cXGAgaXMgbm90IHdyYXBwZWQgYnkgdGhlIFxcYG9uZXRpbWVcXGAgcGFja2FnZWApO1xuXHR9XG5cblx0cmV0dXJuIGNhbGxlZEZ1bmN0aW9ucy5nZXQoZnVuY3Rpb25fKTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cyxcIl9fZXNNb2R1bGVcIix7dmFsdWU6dHJ1ZX0pO2V4cG9ydHMuU0lHTkFMUz12b2lkIDA7XG5cbmNvbnN0IFNJR05BTFM9W1xue1xubmFtZTpcIlNJR0hVUFwiLFxubnVtYmVyOjEsXG5hY3Rpb246XCJ0ZXJtaW5hdGVcIixcbmRlc2NyaXB0aW9uOlwiVGVybWluYWwgY2xvc2VkXCIsXG5zdGFuZGFyZDpcInBvc2l4XCJ9LFxuXG57XG5uYW1lOlwiU0lHSU5UXCIsXG5udW1iZXI6MixcbmFjdGlvbjpcInRlcm1pbmF0ZVwiLFxuZGVzY3JpcHRpb246XCJVc2VyIGludGVycnVwdGlvbiB3aXRoIENUUkwtQ1wiLFxuc3RhbmRhcmQ6XCJhbnNpXCJ9LFxuXG57XG5uYW1lOlwiU0lHUVVJVFwiLFxubnVtYmVyOjMsXG5hY3Rpb246XCJjb3JlXCIsXG5kZXNjcmlwdGlvbjpcIlVzZXIgaW50ZXJydXB0aW9uIHdpdGggQ1RSTC1cXFxcXCIsXG5zdGFuZGFyZDpcInBvc2l4XCJ9LFxuXG57XG5uYW1lOlwiU0lHSUxMXCIsXG5udW1iZXI6NCxcbmFjdGlvbjpcImNvcmVcIixcbmRlc2NyaXB0aW9uOlwiSW52YWxpZCBtYWNoaW5lIGluc3RydWN0aW9uXCIsXG5zdGFuZGFyZDpcImFuc2lcIn0sXG5cbntcbm5hbWU6XCJTSUdUUkFQXCIsXG5udW1iZXI6NSxcbmFjdGlvbjpcImNvcmVcIixcbmRlc2NyaXB0aW9uOlwiRGVidWdnZXIgYnJlYWtwb2ludFwiLFxuc3RhbmRhcmQ6XCJwb3NpeFwifSxcblxue1xubmFtZTpcIlNJR0FCUlRcIixcbm51bWJlcjo2LFxuYWN0aW9uOlwiY29yZVwiLFxuZGVzY3JpcHRpb246XCJBYm9ydGVkXCIsXG5zdGFuZGFyZDpcImFuc2lcIn0sXG5cbntcbm5hbWU6XCJTSUdJT1RcIixcbm51bWJlcjo2LFxuYWN0aW9uOlwiY29yZVwiLFxuZGVzY3JpcHRpb246XCJBYm9ydGVkXCIsXG5zdGFuZGFyZDpcImJzZFwifSxcblxue1xubmFtZTpcIlNJR0JVU1wiLFxubnVtYmVyOjcsXG5hY3Rpb246XCJjb3JlXCIsXG5kZXNjcmlwdGlvbjpcblwiQnVzIGVycm9yIGR1ZSB0byBtaXNhbGlnbmVkLCBub24tZXhpc3RpbmcgYWRkcmVzcyBvciBwYWdpbmcgZXJyb3JcIixcbnN0YW5kYXJkOlwiYnNkXCJ9LFxuXG57XG5uYW1lOlwiU0lHRU1UXCIsXG5udW1iZXI6NyxcbmFjdGlvbjpcInRlcm1pbmF0ZVwiLFxuZGVzY3JpcHRpb246XCJDb21tYW5kIHNob3VsZCBiZSBlbXVsYXRlZCBidXQgaXMgbm90IGltcGxlbWVudGVkXCIsXG5zdGFuZGFyZDpcIm90aGVyXCJ9LFxuXG57XG5uYW1lOlwiU0lHRlBFXCIsXG5udW1iZXI6OCxcbmFjdGlvbjpcImNvcmVcIixcbmRlc2NyaXB0aW9uOlwiRmxvYXRpbmcgcG9pbnQgYXJpdGhtZXRpYyBlcnJvclwiLFxuc3RhbmRhcmQ6XCJhbnNpXCJ9LFxuXG57XG5uYW1lOlwiU0lHS0lMTFwiLFxubnVtYmVyOjksXG5hY3Rpb246XCJ0ZXJtaW5hdGVcIixcbmRlc2NyaXB0aW9uOlwiRm9yY2VkIHRlcm1pbmF0aW9uXCIsXG5zdGFuZGFyZDpcInBvc2l4XCIsXG5mb3JjZWQ6dHJ1ZX0sXG5cbntcbm5hbWU6XCJTSUdVU1IxXCIsXG5udW1iZXI6MTAsXG5hY3Rpb246XCJ0ZXJtaW5hdGVcIixcbmRlc2NyaXB0aW9uOlwiQXBwbGljYXRpb24tc3BlY2lmaWMgc2lnbmFsXCIsXG5zdGFuZGFyZDpcInBvc2l4XCJ9LFxuXG57XG5uYW1lOlwiU0lHU0VHVlwiLFxubnVtYmVyOjExLFxuYWN0aW9uOlwiY29yZVwiLFxuZGVzY3JpcHRpb246XCJTZWdtZW50YXRpb24gZmF1bHRcIixcbnN0YW5kYXJkOlwiYW5zaVwifSxcblxue1xubmFtZTpcIlNJR1VTUjJcIixcbm51bWJlcjoxMixcbmFjdGlvbjpcInRlcm1pbmF0ZVwiLFxuZGVzY3JpcHRpb246XCJBcHBsaWNhdGlvbi1zcGVjaWZpYyBzaWduYWxcIixcbnN0YW5kYXJkOlwicG9zaXhcIn0sXG5cbntcbm5hbWU6XCJTSUdQSVBFXCIsXG5udW1iZXI6MTMsXG5hY3Rpb246XCJ0ZXJtaW5hdGVcIixcbmRlc2NyaXB0aW9uOlwiQnJva2VuIHBpcGUgb3Igc29ja2V0XCIsXG5zdGFuZGFyZDpcInBvc2l4XCJ9LFxuXG57XG5uYW1lOlwiU0lHQUxSTVwiLFxubnVtYmVyOjE0LFxuYWN0aW9uOlwidGVybWluYXRlXCIsXG5kZXNjcmlwdGlvbjpcIlRpbWVvdXQgb3IgdGltZXJcIixcbnN0YW5kYXJkOlwicG9zaXhcIn0sXG5cbntcbm5hbWU6XCJTSUdURVJNXCIsXG5udW1iZXI6MTUsXG5hY3Rpb246XCJ0ZXJtaW5hdGVcIixcbmRlc2NyaXB0aW9uOlwiVGVybWluYXRpb25cIixcbnN0YW5kYXJkOlwiYW5zaVwifSxcblxue1xubmFtZTpcIlNJR1NUS0ZMVFwiLFxubnVtYmVyOjE2LFxuYWN0aW9uOlwidGVybWluYXRlXCIsXG5kZXNjcmlwdGlvbjpcIlN0YWNrIGlzIGVtcHR5IG9yIG92ZXJmbG93ZWRcIixcbnN0YW5kYXJkOlwib3RoZXJcIn0sXG5cbntcbm5hbWU6XCJTSUdDSExEXCIsXG5udW1iZXI6MTcsXG5hY3Rpb246XCJpZ25vcmVcIixcbmRlc2NyaXB0aW9uOlwiQ2hpbGQgcHJvY2VzcyB0ZXJtaW5hdGVkLCBwYXVzZWQgb3IgdW5wYXVzZWRcIixcbnN0YW5kYXJkOlwicG9zaXhcIn0sXG5cbntcbm5hbWU6XCJTSUdDTERcIixcbm51bWJlcjoxNyxcbmFjdGlvbjpcImlnbm9yZVwiLFxuZGVzY3JpcHRpb246XCJDaGlsZCBwcm9jZXNzIHRlcm1pbmF0ZWQsIHBhdXNlZCBvciB1bnBhdXNlZFwiLFxuc3RhbmRhcmQ6XCJvdGhlclwifSxcblxue1xubmFtZTpcIlNJR0NPTlRcIixcbm51bWJlcjoxOCxcbmFjdGlvbjpcInVucGF1c2VcIixcbmRlc2NyaXB0aW9uOlwiVW5wYXVzZWRcIixcbnN0YW5kYXJkOlwicG9zaXhcIixcbmZvcmNlZDp0cnVlfSxcblxue1xubmFtZTpcIlNJR1NUT1BcIixcbm51bWJlcjoxOSxcbmFjdGlvbjpcInBhdXNlXCIsXG5kZXNjcmlwdGlvbjpcIlBhdXNlZFwiLFxuc3RhbmRhcmQ6XCJwb3NpeFwiLFxuZm9yY2VkOnRydWV9LFxuXG57XG5uYW1lOlwiU0lHVFNUUFwiLFxubnVtYmVyOjIwLFxuYWN0aW9uOlwicGF1c2VcIixcbmRlc2NyaXB0aW9uOlwiUGF1c2VkIHVzaW5nIENUUkwtWiBvciBcXFwic3VzcGVuZFxcXCJcIixcbnN0YW5kYXJkOlwicG9zaXhcIn0sXG5cbntcbm5hbWU6XCJTSUdUVElOXCIsXG5udW1iZXI6MjEsXG5hY3Rpb246XCJwYXVzZVwiLFxuZGVzY3JpcHRpb246XCJCYWNrZ3JvdW5kIHByb2Nlc3MgY2Fubm90IHJlYWQgdGVybWluYWwgaW5wdXRcIixcbnN0YW5kYXJkOlwicG9zaXhcIn0sXG5cbntcbm5hbWU6XCJTSUdCUkVBS1wiLFxubnVtYmVyOjIxLFxuYWN0aW9uOlwidGVybWluYXRlXCIsXG5kZXNjcmlwdGlvbjpcIlVzZXIgaW50ZXJydXB0aW9uIHdpdGggQ1RSTC1CUkVBS1wiLFxuc3RhbmRhcmQ6XCJvdGhlclwifSxcblxue1xubmFtZTpcIlNJR1RUT1VcIixcbm51bWJlcjoyMixcbmFjdGlvbjpcInBhdXNlXCIsXG5kZXNjcmlwdGlvbjpcIkJhY2tncm91bmQgcHJvY2VzcyBjYW5ub3Qgd3JpdGUgdG8gdGVybWluYWwgb3V0cHV0XCIsXG5zdGFuZGFyZDpcInBvc2l4XCJ9LFxuXG57XG5uYW1lOlwiU0lHVVJHXCIsXG5udW1iZXI6MjMsXG5hY3Rpb246XCJpZ25vcmVcIixcbmRlc2NyaXB0aW9uOlwiU29ja2V0IHJlY2VpdmVkIG91dC1vZi1iYW5kIGRhdGFcIixcbnN0YW5kYXJkOlwiYnNkXCJ9LFxuXG57XG5uYW1lOlwiU0lHWENQVVwiLFxubnVtYmVyOjI0LFxuYWN0aW9uOlwiY29yZVwiLFxuZGVzY3JpcHRpb246XCJQcm9jZXNzIHRpbWVkIG91dFwiLFxuc3RhbmRhcmQ6XCJic2RcIn0sXG5cbntcbm5hbWU6XCJTSUdYRlNaXCIsXG5udW1iZXI6MjUsXG5hY3Rpb246XCJjb3JlXCIsXG5kZXNjcmlwdGlvbjpcIkZpbGUgdG9vIGJpZ1wiLFxuc3RhbmRhcmQ6XCJic2RcIn0sXG5cbntcbm5hbWU6XCJTSUdWVEFMUk1cIixcbm51bWJlcjoyNixcbmFjdGlvbjpcInRlcm1pbmF0ZVwiLFxuZGVzY3JpcHRpb246XCJUaW1lb3V0IG9yIHRpbWVyXCIsXG5zdGFuZGFyZDpcImJzZFwifSxcblxue1xubmFtZTpcIlNJR1BST0ZcIixcbm51bWJlcjoyNyxcbmFjdGlvbjpcInRlcm1pbmF0ZVwiLFxuZGVzY3JpcHRpb246XCJUaW1lb3V0IG9yIHRpbWVyXCIsXG5zdGFuZGFyZDpcImJzZFwifSxcblxue1xubmFtZTpcIlNJR1dJTkNIXCIsXG5udW1iZXI6MjgsXG5hY3Rpb246XCJpZ25vcmVcIixcbmRlc2NyaXB0aW9uOlwiVGVybWluYWwgd2luZG93IHNpemUgY2hhbmdlZFwiLFxuc3RhbmRhcmQ6XCJic2RcIn0sXG5cbntcbm5hbWU6XCJTSUdJT1wiLFxubnVtYmVyOjI5LFxuYWN0aW9uOlwidGVybWluYXRlXCIsXG5kZXNjcmlwdGlvbjpcIkkvTyBpcyBhdmFpbGFibGVcIixcbnN0YW5kYXJkOlwib3RoZXJcIn0sXG5cbntcbm5hbWU6XCJTSUdQT0xMXCIsXG5udW1iZXI6MjksXG5hY3Rpb246XCJ0ZXJtaW5hdGVcIixcbmRlc2NyaXB0aW9uOlwiV2F0Y2hlZCBldmVudFwiLFxuc3RhbmRhcmQ6XCJvdGhlclwifSxcblxue1xubmFtZTpcIlNJR0lORk9cIixcbm51bWJlcjoyOSxcbmFjdGlvbjpcImlnbm9yZVwiLFxuZGVzY3JpcHRpb246XCJSZXF1ZXN0IGZvciBwcm9jZXNzIGluZm9ybWF0aW9uXCIsXG5zdGFuZGFyZDpcIm90aGVyXCJ9LFxuXG57XG5uYW1lOlwiU0lHUFdSXCIsXG5udW1iZXI6MzAsXG5hY3Rpb246XCJ0ZXJtaW5hdGVcIixcbmRlc2NyaXB0aW9uOlwiRGV2aWNlIHJ1bm5pbmcgb3V0IG9mIHBvd2VyXCIsXG5zdGFuZGFyZDpcInN5c3RlbXZcIn0sXG5cbntcbm5hbWU6XCJTSUdTWVNcIixcbm51bWJlcjozMSxcbmFjdGlvbjpcImNvcmVcIixcbmRlc2NyaXB0aW9uOlwiSW52YWxpZCBzeXN0ZW0gY2FsbFwiLFxuc3RhbmRhcmQ6XCJvdGhlclwifSxcblxue1xubmFtZTpcIlNJR1VOVVNFRFwiLFxubnVtYmVyOjMxLFxuYWN0aW9uOlwidGVybWluYXRlXCIsXG5kZXNjcmlwdGlvbjpcIkludmFsaWQgc3lzdGVtIGNhbGxcIixcbnN0YW5kYXJkOlwib3RoZXJcIn1dO2V4cG9ydHMuU0lHTkFMUz1TSUdOQUxTO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y29yZS5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cyxcIl9fZXNNb2R1bGVcIix7dmFsdWU6dHJ1ZX0pO2V4cG9ydHMuU0lHUlRNQVg9ZXhwb3J0cy5nZXRSZWFsdGltZVNpZ25hbHM9dm9pZCAwO1xuY29uc3QgZ2V0UmVhbHRpbWVTaWduYWxzPWZ1bmN0aW9uKCl7XG5jb25zdCBsZW5ndGg9U0lHUlRNQVgtU0lHUlRNSU4rMTtcbnJldHVybiBBcnJheS5mcm9tKHtsZW5ndGh9LGdldFJlYWx0aW1lU2lnbmFsKTtcbn07ZXhwb3J0cy5nZXRSZWFsdGltZVNpZ25hbHM9Z2V0UmVhbHRpbWVTaWduYWxzO1xuXG5jb25zdCBnZXRSZWFsdGltZVNpZ25hbD1mdW5jdGlvbih2YWx1ZSxpbmRleCl7XG5yZXR1cm57XG5uYW1lOmBTSUdSVCR7aW5kZXgrMX1gLFxubnVtYmVyOlNJR1JUTUlOK2luZGV4LFxuYWN0aW9uOlwidGVybWluYXRlXCIsXG5kZXNjcmlwdGlvbjpcIkFwcGxpY2F0aW9uLXNwZWNpZmljIHNpZ25hbCAocmVhbHRpbWUpXCIsXG5zdGFuZGFyZDpcInBvc2l4XCJ9O1xuXG59O1xuXG5jb25zdCBTSUdSVE1JTj0zNDtcbmNvbnN0IFNJR1JUTUFYPTY0O2V4cG9ydHMuU0lHUlRNQVg9U0lHUlRNQVg7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1yZWFsdGltZS5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cyxcIl9fZXNNb2R1bGVcIix7dmFsdWU6dHJ1ZX0pO2V4cG9ydHMuZ2V0U2lnbmFscz12b2lkIDA7dmFyIF9vcz1yZXF1aXJlKFwib3NcIik7XG5cbnZhciBfY29yZT1yZXF1aXJlKFwiLi9jb3JlLmpzXCIpO1xudmFyIF9yZWFsdGltZT1yZXF1aXJlKFwiLi9yZWFsdGltZS5qc1wiKTtcblxuXG5cbmNvbnN0IGdldFNpZ25hbHM9ZnVuY3Rpb24oKXtcbmNvbnN0IHJlYWx0aW1lU2lnbmFscz0oMCxfcmVhbHRpbWUuZ2V0UmVhbHRpbWVTaWduYWxzKSgpO1xuY29uc3Qgc2lnbmFscz1bLi4uX2NvcmUuU0lHTkFMUywuLi5yZWFsdGltZVNpZ25hbHNdLm1hcChub3JtYWxpemVTaWduYWwpO1xucmV0dXJuIHNpZ25hbHM7XG59O2V4cG9ydHMuZ2V0U2lnbmFscz1nZXRTaWduYWxzO1xuXG5cblxuXG5cblxuXG5jb25zdCBub3JtYWxpemVTaWduYWw9ZnVuY3Rpb24oe1xubmFtZSxcbm51bWJlcjpkZWZhdWx0TnVtYmVyLFxuZGVzY3JpcHRpb24sXG5hY3Rpb24sXG5mb3JjZWQ9ZmFsc2UsXG5zdGFuZGFyZH0pXG57XG5jb25zdHtcbnNpZ25hbHM6e1tuYW1lXTpjb25zdGFudFNpZ25hbH19PVxuX29zLmNvbnN0YW50cztcbmNvbnN0IHN1cHBvcnRlZD1jb25zdGFudFNpZ25hbCE9PXVuZGVmaW5lZDtcbmNvbnN0IG51bWJlcj1zdXBwb3J0ZWQ/Y29uc3RhbnRTaWduYWw6ZGVmYXVsdE51bWJlcjtcbnJldHVybntuYW1lLG51bWJlcixkZXNjcmlwdGlvbixzdXBwb3J0ZWQsYWN0aW9uLGZvcmNlZCxzdGFuZGFyZH07XG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9c2lnbmFscy5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cyxcIl9fZXNNb2R1bGVcIix7dmFsdWU6dHJ1ZX0pO2V4cG9ydHMuc2lnbmFsc0J5TnVtYmVyPWV4cG9ydHMuc2lnbmFsc0J5TmFtZT12b2lkIDA7dmFyIF9vcz1yZXF1aXJlKFwib3NcIik7XG5cbnZhciBfc2lnbmFscz1yZXF1aXJlKFwiLi9zaWduYWxzLmpzXCIpO1xudmFyIF9yZWFsdGltZT1yZXF1aXJlKFwiLi9yZWFsdGltZS5qc1wiKTtcblxuXG5cbmNvbnN0IGdldFNpZ25hbHNCeU5hbWU9ZnVuY3Rpb24oKXtcbmNvbnN0IHNpZ25hbHM9KDAsX3NpZ25hbHMuZ2V0U2lnbmFscykoKTtcbnJldHVybiBzaWduYWxzLnJlZHVjZShnZXRTaWduYWxCeU5hbWUse30pO1xufTtcblxuY29uc3QgZ2V0U2lnbmFsQnlOYW1lPWZ1bmN0aW9uKFxuc2lnbmFsQnlOYW1lTWVtbyxcbntuYW1lLG51bWJlcixkZXNjcmlwdGlvbixzdXBwb3J0ZWQsYWN0aW9uLGZvcmNlZCxzdGFuZGFyZH0pXG57XG5yZXR1cm57XG4uLi5zaWduYWxCeU5hbWVNZW1vLFxuW25hbWVdOntuYW1lLG51bWJlcixkZXNjcmlwdGlvbixzdXBwb3J0ZWQsYWN0aW9uLGZvcmNlZCxzdGFuZGFyZH19O1xuXG59O1xuXG5jb25zdCBzaWduYWxzQnlOYW1lPWdldFNpZ25hbHNCeU5hbWUoKTtleHBvcnRzLnNpZ25hbHNCeU5hbWU9c2lnbmFsc0J5TmFtZTtcblxuXG5cblxuY29uc3QgZ2V0U2lnbmFsc0J5TnVtYmVyPWZ1bmN0aW9uKCl7XG5jb25zdCBzaWduYWxzPSgwLF9zaWduYWxzLmdldFNpZ25hbHMpKCk7XG5jb25zdCBsZW5ndGg9X3JlYWx0aW1lLlNJR1JUTUFYKzE7XG5jb25zdCBzaWduYWxzQT1BcnJheS5mcm9tKHtsZW5ndGh9LCh2YWx1ZSxudW1iZXIpPT5cbmdldFNpZ25hbEJ5TnVtYmVyKG51bWJlcixzaWduYWxzKSk7XG5cbnJldHVybiBPYmplY3QuYXNzaWduKHt9LC4uLnNpZ25hbHNBKTtcbn07XG5cbmNvbnN0IGdldFNpZ25hbEJ5TnVtYmVyPWZ1bmN0aW9uKG51bWJlcixzaWduYWxzKXtcbmNvbnN0IHNpZ25hbD1maW5kU2lnbmFsQnlOdW1iZXIobnVtYmVyLHNpZ25hbHMpO1xuXG5pZihzaWduYWw9PT11bmRlZmluZWQpe1xucmV0dXJue307XG59XG5cbmNvbnN0e25hbWUsZGVzY3JpcHRpb24sc3VwcG9ydGVkLGFjdGlvbixmb3JjZWQsc3RhbmRhcmR9PXNpZ25hbDtcbnJldHVybntcbltudW1iZXJdOntcbm5hbWUsXG5udW1iZXIsXG5kZXNjcmlwdGlvbixcbnN1cHBvcnRlZCxcbmFjdGlvbixcbmZvcmNlZCxcbnN0YW5kYXJkfX07XG5cblxufTtcblxuXG5cbmNvbnN0IGZpbmRTaWduYWxCeU51bWJlcj1mdW5jdGlvbihudW1iZXIsc2lnbmFscyl7XG5jb25zdCBzaWduYWw9c2lnbmFscy5maW5kKCh7bmFtZX0pPT5fb3MuY29uc3RhbnRzLnNpZ25hbHNbbmFtZV09PT1udW1iZXIpO1xuXG5pZihzaWduYWwhPT11bmRlZmluZWQpe1xucmV0dXJuIHNpZ25hbDtcbn1cblxucmV0dXJuIHNpZ25hbHMuZmluZChzaWduYWxBPT5zaWduYWxBLm51bWJlcj09PW51bWJlcik7XG59O1xuXG5jb25zdCBzaWduYWxzQnlOdW1iZXI9Z2V0U2lnbmFsc0J5TnVtYmVyKCk7ZXhwb3J0cy5zaWduYWxzQnlOdW1iZXI9c2lnbmFsc0J5TnVtYmVyO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9bWFpbi5qcy5tYXAiLCIndXNlIHN0cmljdCc7XG5jb25zdCB7c2lnbmFsc0J5TmFtZX0gPSByZXF1aXJlKCdodW1hbi1zaWduYWxzJyk7XG5cbmNvbnN0IGdldEVycm9yUHJlZml4ID0gKHt0aW1lZE91dCwgdGltZW91dCwgZXJyb3JDb2RlLCBzaWduYWwsIHNpZ25hbERlc2NyaXB0aW9uLCBleGl0Q29kZSwgaXNDYW5jZWxlZH0pID0+IHtcblx0aWYgKHRpbWVkT3V0KSB7XG5cdFx0cmV0dXJuIGB0aW1lZCBvdXQgYWZ0ZXIgJHt0aW1lb3V0fSBtaWxsaXNlY29uZHNgO1xuXHR9XG5cblx0aWYgKGlzQ2FuY2VsZWQpIHtcblx0XHRyZXR1cm4gJ3dhcyBjYW5jZWxlZCc7XG5cdH1cblxuXHRpZiAoZXJyb3JDb2RlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gYGZhaWxlZCB3aXRoICR7ZXJyb3JDb2RlfWA7XG5cdH1cblxuXHRpZiAoc2lnbmFsICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gYHdhcyBraWxsZWQgd2l0aCAke3NpZ25hbH0gKCR7c2lnbmFsRGVzY3JpcHRpb259KWA7XG5cdH1cblxuXHRpZiAoZXhpdENvZGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBgZmFpbGVkIHdpdGggZXhpdCBjb2RlICR7ZXhpdENvZGV9YDtcblx0fVxuXG5cdHJldHVybiAnZmFpbGVkJztcbn07XG5cbmNvbnN0IG1ha2VFcnJvciA9ICh7XG5cdHN0ZG91dCxcblx0c3RkZXJyLFxuXHRhbGwsXG5cdGVycm9yLFxuXHRzaWduYWwsXG5cdGV4aXRDb2RlLFxuXHRjb21tYW5kLFxuXHRlc2NhcGVkQ29tbWFuZCxcblx0dGltZWRPdXQsXG5cdGlzQ2FuY2VsZWQsXG5cdGtpbGxlZCxcblx0cGFyc2VkOiB7b3B0aW9uczoge3RpbWVvdXR9fVxufSkgPT4ge1xuXHQvLyBgc2lnbmFsYCBhbmQgYGV4aXRDb2RlYCBlbWl0dGVkIG9uIGBzcGF3bmVkLm9uKCdleGl0JylgIGV2ZW50IGNhbiBiZSBgbnVsbGAuXG5cdC8vIFdlIG5vcm1hbGl6ZSB0aGVtIHRvIGB1bmRlZmluZWRgXG5cdGV4aXRDb2RlID0gZXhpdENvZGUgPT09IG51bGwgPyB1bmRlZmluZWQgOiBleGl0Q29kZTtcblx0c2lnbmFsID0gc2lnbmFsID09PSBudWxsID8gdW5kZWZpbmVkIDogc2lnbmFsO1xuXHRjb25zdCBzaWduYWxEZXNjcmlwdGlvbiA9IHNpZ25hbCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogc2lnbmFsc0J5TmFtZVtzaWduYWxdLmRlc2NyaXB0aW9uO1xuXG5cdGNvbnN0IGVycm9yQ29kZSA9IGVycm9yICYmIGVycm9yLmNvZGU7XG5cblx0Y29uc3QgcHJlZml4ID0gZ2V0RXJyb3JQcmVmaXgoe3RpbWVkT3V0LCB0aW1lb3V0LCBlcnJvckNvZGUsIHNpZ25hbCwgc2lnbmFsRGVzY3JpcHRpb24sIGV4aXRDb2RlLCBpc0NhbmNlbGVkfSk7XG5cdGNvbnN0IGV4ZWNhTWVzc2FnZSA9IGBDb21tYW5kICR7cHJlZml4fTogJHtjb21tYW5kfWA7XG5cdGNvbnN0IGlzRXJyb3IgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoZXJyb3IpID09PSAnW29iamVjdCBFcnJvcl0nO1xuXHRjb25zdCBzaG9ydE1lc3NhZ2UgPSBpc0Vycm9yID8gYCR7ZXhlY2FNZXNzYWdlfVxcbiR7ZXJyb3IubWVzc2FnZX1gIDogZXhlY2FNZXNzYWdlO1xuXHRjb25zdCBtZXNzYWdlID0gW3Nob3J0TWVzc2FnZSwgc3RkZXJyLCBzdGRvdXRdLmZpbHRlcihCb29sZWFuKS5qb2luKCdcXG4nKTtcblxuXHRpZiAoaXNFcnJvcikge1xuXHRcdGVycm9yLm9yaWdpbmFsTWVzc2FnZSA9IGVycm9yLm1lc3NhZ2U7XG5cdFx0ZXJyb3IubWVzc2FnZSA9IG1lc3NhZ2U7XG5cdH0gZWxzZSB7XG5cdFx0ZXJyb3IgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG5cdH1cblxuXHRlcnJvci5zaG9ydE1lc3NhZ2UgPSBzaG9ydE1lc3NhZ2U7XG5cdGVycm9yLmNvbW1hbmQgPSBjb21tYW5kO1xuXHRlcnJvci5lc2NhcGVkQ29tbWFuZCA9IGVzY2FwZWRDb21tYW5kO1xuXHRlcnJvci5leGl0Q29kZSA9IGV4aXRDb2RlO1xuXHRlcnJvci5zaWduYWwgPSBzaWduYWw7XG5cdGVycm9yLnNpZ25hbERlc2NyaXB0aW9uID0gc2lnbmFsRGVzY3JpcHRpb247XG5cdGVycm9yLnN0ZG91dCA9IHN0ZG91dDtcblx0ZXJyb3Iuc3RkZXJyID0gc3RkZXJyO1xuXG5cdGlmIChhbGwgIT09IHVuZGVmaW5lZCkge1xuXHRcdGVycm9yLmFsbCA9IGFsbDtcblx0fVxuXG5cdGlmICgnYnVmZmVyZWREYXRhJyBpbiBlcnJvcikge1xuXHRcdGRlbGV0ZSBlcnJvci5idWZmZXJlZERhdGE7XG5cdH1cblxuXHRlcnJvci5mYWlsZWQgPSB0cnVlO1xuXHRlcnJvci50aW1lZE91dCA9IEJvb2xlYW4odGltZWRPdXQpO1xuXHRlcnJvci5pc0NhbmNlbGVkID0gaXNDYW5jZWxlZDtcblx0ZXJyb3Iua2lsbGVkID0ga2lsbGVkICYmICF0aW1lZE91dDtcblxuXHRyZXR1cm4gZXJyb3I7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG1ha2VFcnJvcjtcbiIsIid1c2Ugc3RyaWN0JztcbmNvbnN0IGFsaWFzZXMgPSBbJ3N0ZGluJywgJ3N0ZG91dCcsICdzdGRlcnInXTtcblxuY29uc3QgaGFzQWxpYXMgPSBvcHRpb25zID0+IGFsaWFzZXMuc29tZShhbGlhcyA9PiBvcHRpb25zW2FsaWFzXSAhPT0gdW5kZWZpbmVkKTtcblxuY29uc3Qgbm9ybWFsaXplU3RkaW8gPSBvcHRpb25zID0+IHtcblx0aWYgKCFvcHRpb25zKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3Qge3N0ZGlvfSA9IG9wdGlvbnM7XG5cblx0aWYgKHN0ZGlvID09PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gYWxpYXNlcy5tYXAoYWxpYXMgPT4gb3B0aW9uc1thbGlhc10pO1xuXHR9XG5cblx0aWYgKGhhc0FsaWFzKG9wdGlvbnMpKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJdCdzIG5vdCBwb3NzaWJsZSB0byBwcm92aWRlIFxcYHN0ZGlvXFxgIGluIGNvbWJpbmF0aW9uIHdpdGggb25lIG9mICR7YWxpYXNlcy5tYXAoYWxpYXMgPT4gYFxcYCR7YWxpYXN9XFxgYCkuam9pbignLCAnKX1gKTtcblx0fVxuXG5cdGlmICh0eXBlb2Ygc3RkaW8gPT09ICdzdHJpbmcnKSB7XG5cdFx0cmV0dXJuIHN0ZGlvO1xuXHR9XG5cblx0aWYgKCFBcnJheS5pc0FycmF5KHN0ZGlvKSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoYEV4cGVjdGVkIFxcYHN0ZGlvXFxgIHRvIGJlIG9mIHR5cGUgXFxgc3RyaW5nXFxgIG9yIFxcYEFycmF5XFxgLCBnb3QgXFxgJHt0eXBlb2Ygc3RkaW99XFxgYCk7XG5cdH1cblxuXHRjb25zdCBsZW5ndGggPSBNYXRoLm1heChzdGRpby5sZW5ndGgsIGFsaWFzZXMubGVuZ3RoKTtcblx0cmV0dXJuIEFycmF5LmZyb20oe2xlbmd0aH0sICh2YWx1ZSwgaW5kZXgpID0+IHN0ZGlvW2luZGV4XSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5vcm1hbGl6ZVN0ZGlvO1xuXG4vLyBgaXBjYCBpcyBwdXNoZWQgdW5sZXNzIGl0IGlzIGFscmVhZHkgcHJlc2VudFxubW9kdWxlLmV4cG9ydHMubm9kZSA9IG9wdGlvbnMgPT4ge1xuXHRjb25zdCBzdGRpbyA9IG5vcm1hbGl6ZVN0ZGlvKG9wdGlvbnMpO1xuXG5cdGlmIChzdGRpbyA9PT0gJ2lwYycpIHtcblx0XHRyZXR1cm4gJ2lwYyc7XG5cdH1cblxuXHRpZiAoc3RkaW8gPT09IHVuZGVmaW5lZCB8fCB0eXBlb2Ygc3RkaW8gPT09ICdzdHJpbmcnKSB7XG5cdFx0cmV0dXJuIFtzdGRpbywgc3RkaW8sIHN0ZGlvLCAnaXBjJ107XG5cdH1cblxuXHRpZiAoc3RkaW8uaW5jbHVkZXMoJ2lwYycpKSB7XG5cdFx0cmV0dXJuIHN0ZGlvO1xuXHR9XG5cblx0cmV0dXJuIFsuLi5zdGRpbywgJ2lwYyddO1xufTtcbiIsIi8vIFRoaXMgaXMgbm90IHRoZSBzZXQgb2YgYWxsIHBvc3NpYmxlIHNpZ25hbHMuXG4vL1xuLy8gSXQgSVMsIGhvd2V2ZXIsIHRoZSBzZXQgb2YgYWxsIHNpZ25hbHMgdGhhdCB0cmlnZ2VyXG4vLyBhbiBleGl0IG9uIGVpdGhlciBMaW51eCBvciBCU0Qgc3lzdGVtcy4gIExpbnV4IGlzIGFcbi8vIHN1cGVyc2V0IG9mIHRoZSBzaWduYWwgbmFtZXMgc3VwcG9ydGVkIG9uIEJTRCwgYW5kXG4vLyB0aGUgdW5rbm93biBzaWduYWxzIGp1c3QgZmFpbCB0byByZWdpc3Rlciwgc28gd2UgY2FuXG4vLyBjYXRjaCB0aGF0IGVhc2lseSBlbm91Z2guXG4vL1xuLy8gRG9uJ3QgYm90aGVyIHdpdGggU0lHS0lMTC4gIEl0J3MgdW5jYXRjaGFibGUsIHdoaWNoXG4vLyBtZWFucyB0aGF0IHdlIGNhbid0IGZpcmUgYW55IGNhbGxiYWNrcyBhbnl3YXkuXG4vL1xuLy8gSWYgYSB1c2VyIGRvZXMgaGFwcGVuIHRvIHJlZ2lzdGVyIGEgaGFuZGxlciBvbiBhIG5vbi1cbi8vIGZhdGFsIHNpZ25hbCBsaWtlIFNJR1dJTkNIIG9yIHNvbWV0aGluZywgYW5kIHRoZW5cbi8vIGV4aXQsIGl0J2xsIGVuZCB1cCBmaXJpbmcgYHByb2Nlc3MuZW1pdCgnZXhpdCcpYCwgc29cbi8vIHRoZSBoYW5kbGVyIHdpbGwgYmUgZmlyZWQgYW55d2F5LlxuLy9cbi8vIFNJR0JVUywgU0lHRlBFLCBTSUdTRUdWIGFuZCBTSUdJTEwsIHdoZW4gbm90IHJhaXNlZFxuLy8gYXJ0aWZpY2lhbGx5LCBpbmhlcmVudGx5IGxlYXZlIHRoZSBwcm9jZXNzIGluIGFcbi8vIHN0YXRlIGZyb20gd2hpY2ggaXQgaXMgbm90IHNhZmUgdG8gdHJ5IGFuZCBlbnRlciBKU1xuLy8gbGlzdGVuZXJzLlxubW9kdWxlLmV4cG9ydHMgPSBbXG4gICdTSUdBQlJUJyxcbiAgJ1NJR0FMUk0nLFxuICAnU0lHSFVQJyxcbiAgJ1NJR0lOVCcsXG4gICdTSUdURVJNJ1xuXVxuXG5pZiAocHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ3dpbjMyJykge1xuICBtb2R1bGUuZXhwb3J0cy5wdXNoKFxuICAgICdTSUdWVEFMUk0nLFxuICAgICdTSUdYQ1BVJyxcbiAgICAnU0lHWEZTWicsXG4gICAgJ1NJR1VTUjInLFxuICAgICdTSUdUUkFQJyxcbiAgICAnU0lHU1lTJyxcbiAgICAnU0lHUVVJVCcsXG4gICAgJ1NJR0lPVCdcbiAgICAvLyBzaG91bGQgZGV0ZWN0IHByb2ZpbGVyIGFuZCBlbmFibGUvZGlzYWJsZSBhY2NvcmRpbmdseS5cbiAgICAvLyBzZWUgIzIxXG4gICAgLy8gJ1NJR1BST0YnXG4gIClcbn1cblxuaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgbW9kdWxlLmV4cG9ydHMucHVzaChcbiAgICAnU0lHSU8nLFxuICAgICdTSUdQT0xMJyxcbiAgICAnU0lHUFdSJyxcbiAgICAnU0lHU1RLRkxUJyxcbiAgICAnU0lHVU5VU0VEJ1xuICApXG59XG4iLCIvLyBOb3RlOiBzaW5jZSBueWMgdXNlcyB0aGlzIG1vZHVsZSB0byBvdXRwdXQgY292ZXJhZ2UsIGFueSBsaW5lc1xuLy8gdGhhdCBhcmUgaW4gdGhlIGRpcmVjdCBzeW5jIGZsb3cgb2YgbnljJ3Mgb3V0cHV0Q292ZXJhZ2UgYXJlXG4vLyBpZ25vcmVkLCBzaW5jZSB3ZSBjYW4gbmV2ZXIgZ2V0IGNvdmVyYWdlIGZvciB0aGVtLlxuLy8gZ3JhYiBhIHJlZmVyZW5jZSB0byBub2RlJ3MgcmVhbCBwcm9jZXNzIG9iamVjdCByaWdodCBhd2F5XG52YXIgcHJvY2VzcyA9IGdsb2JhbC5wcm9jZXNzXG5cbmNvbnN0IHByb2Nlc3NPayA9IGZ1bmN0aW9uIChwcm9jZXNzKSB7XG4gIHJldHVybiBwcm9jZXNzICYmXG4gICAgdHlwZW9mIHByb2Nlc3MgPT09ICdvYmplY3QnICYmXG4gICAgdHlwZW9mIHByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPT09ICdmdW5jdGlvbicgJiZcbiAgICB0eXBlb2YgcHJvY2Vzcy5lbWl0ID09PSAnZnVuY3Rpb24nICYmXG4gICAgdHlwZW9mIHByb2Nlc3MucmVhbGx5RXhpdCA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgIHR5cGVvZiBwcm9jZXNzLmxpc3RlbmVycyA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgIHR5cGVvZiBwcm9jZXNzLmtpbGwgPT09ICdmdW5jdGlvbicgJiZcbiAgICB0eXBlb2YgcHJvY2Vzcy5waWQgPT09ICdudW1iZXInICYmXG4gICAgdHlwZW9mIHByb2Nlc3Mub24gPT09ICdmdW5jdGlvbidcbn1cblxuLy8gc29tZSBraW5kIG9mIG5vbi1ub2RlIGVudmlyb25tZW50LCBqdXN0IG5vLW9wXG4vKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbmlmICghcHJvY2Vzc09rKHByb2Nlc3MpKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7fVxuICB9XG59IGVsc2Uge1xuICB2YXIgYXNzZXJ0ID0gcmVxdWlyZSgnYXNzZXJ0JylcbiAgdmFyIHNpZ25hbHMgPSByZXF1aXJlKCcuL3NpZ25hbHMuanMnKVxuICB2YXIgaXNXaW4gPSAvXndpbi9pLnRlc3QocHJvY2Vzcy5wbGF0Zm9ybSlcblxuICB2YXIgRUUgPSByZXF1aXJlKCdldmVudHMnKVxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKHR5cGVvZiBFRSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIEVFID0gRUUuRXZlbnRFbWl0dGVyXG4gIH1cblxuICB2YXIgZW1pdHRlclxuICBpZiAocHJvY2Vzcy5fX3NpZ25hbF9leGl0X2VtaXR0ZXJfXykge1xuICAgIGVtaXR0ZXIgPSBwcm9jZXNzLl9fc2lnbmFsX2V4aXRfZW1pdHRlcl9fXG4gIH0gZWxzZSB7XG4gICAgZW1pdHRlciA9IHByb2Nlc3MuX19zaWduYWxfZXhpdF9lbWl0dGVyX18gPSBuZXcgRUUoKVxuICAgIGVtaXR0ZXIuY291bnQgPSAwXG4gICAgZW1pdHRlci5lbWl0dGVkID0ge31cbiAgfVxuXG4gIC8vIEJlY2F1c2UgdGhpcyBlbWl0dGVyIGlzIGEgZ2xvYmFsLCB3ZSBoYXZlIHRvIGNoZWNrIHRvIHNlZSBpZiBhXG4gIC8vIHByZXZpb3VzIHZlcnNpb24gb2YgdGhpcyBsaWJyYXJ5IGZhaWxlZCB0byBlbmFibGUgaW5maW5pdGUgbGlzdGVuZXJzLlxuICAvLyBJIGtub3cgd2hhdCB5b3UncmUgYWJvdXQgdG8gc2F5LiAgQnV0IGxpdGVyYWxseSBldmVyeXRoaW5nIGFib3V0XG4gIC8vIHNpZ25hbC1leGl0IGlzIGEgY29tcHJvbWlzZSB3aXRoIGV2aWwuICBHZXQgdXNlZCB0byBpdC5cbiAgaWYgKCFlbWl0dGVyLmluZmluaXRlKSB7XG4gICAgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoSW5maW5pdHkpXG4gICAgZW1pdHRlci5pbmZpbml0ZSA9IHRydWVcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGNiLCBvcHRzKSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKCFwcm9jZXNzT2soZ2xvYmFsLnByb2Nlc3MpKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKCkge31cbiAgICB9XG4gICAgYXNzZXJ0LmVxdWFsKHR5cGVvZiBjYiwgJ2Z1bmN0aW9uJywgJ2EgY2FsbGJhY2sgbXVzdCBiZSBwcm92aWRlZCBmb3IgZXhpdCBoYW5kbGVyJylcblxuICAgIGlmIChsb2FkZWQgPT09IGZhbHNlKSB7XG4gICAgICBsb2FkKClcbiAgICB9XG5cbiAgICB2YXIgZXYgPSAnZXhpdCdcbiAgICBpZiAob3B0cyAmJiBvcHRzLmFsd2F5c0xhc3QpIHtcbiAgICAgIGV2ID0gJ2FmdGVyZXhpdCdcbiAgICB9XG5cbiAgICB2YXIgcmVtb3ZlID0gZnVuY3Rpb24gKCkge1xuICAgICAgZW1pdHRlci5yZW1vdmVMaXN0ZW5lcihldiwgY2IpXG4gICAgICBpZiAoZW1pdHRlci5saXN0ZW5lcnMoJ2V4aXQnKS5sZW5ndGggPT09IDAgJiZcbiAgICAgICAgICBlbWl0dGVyLmxpc3RlbmVycygnYWZ0ZXJleGl0JykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHVubG9hZCgpXG4gICAgICB9XG4gICAgfVxuICAgIGVtaXR0ZXIub24oZXYsIGNiKVxuXG4gICAgcmV0dXJuIHJlbW92ZVxuICB9XG5cbiAgdmFyIHVubG9hZCA9IGZ1bmN0aW9uIHVubG9hZCAoKSB7XG4gICAgaWYgKCFsb2FkZWQgfHwgIXByb2Nlc3NPayhnbG9iYWwucHJvY2VzcykpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBsb2FkZWQgPSBmYWxzZVxuXG4gICAgc2lnbmFscy5mb3JFYWNoKGZ1bmN0aW9uIChzaWcpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHByb2Nlc3MucmVtb3ZlTGlzdGVuZXIoc2lnLCBzaWdMaXN0ZW5lcnNbc2lnXSlcbiAgICAgIH0gY2F0Y2ggKGVyKSB7fVxuICAgIH0pXG4gICAgcHJvY2Vzcy5lbWl0ID0gb3JpZ2luYWxQcm9jZXNzRW1pdFxuICAgIHByb2Nlc3MucmVhbGx5RXhpdCA9IG9yaWdpbmFsUHJvY2Vzc1JlYWxseUV4aXRcbiAgICBlbWl0dGVyLmNvdW50IC09IDFcbiAgfVxuICBtb2R1bGUuZXhwb3J0cy51bmxvYWQgPSB1bmxvYWRcblxuICB2YXIgZW1pdCA9IGZ1bmN0aW9uIGVtaXQgKGV2ZW50LCBjb2RlLCBzaWduYWwpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAoZW1pdHRlci5lbWl0dGVkW2V2ZW50XSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGVtaXR0ZXIuZW1pdHRlZFtldmVudF0gPSB0cnVlXG4gICAgZW1pdHRlci5lbWl0KGV2ZW50LCBjb2RlLCBzaWduYWwpXG4gIH1cblxuICAvLyB7IDxzaWduYWw+OiA8bGlzdGVuZXIgZm4+LCAuLi4gfVxuICB2YXIgc2lnTGlzdGVuZXJzID0ge31cbiAgc2lnbmFscy5mb3JFYWNoKGZ1bmN0aW9uIChzaWcpIHtcbiAgICBzaWdMaXN0ZW5lcnNbc2lnXSA9IGZ1bmN0aW9uIGxpc3RlbmVyICgpIHtcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKCFwcm9jZXNzT2soZ2xvYmFsLnByb2Nlc3MpKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgLy8gSWYgdGhlcmUgYXJlIG5vIG90aGVyIGxpc3RlbmVycywgYW4gZXhpdCBpcyBjb21pbmchXG4gICAgICAvLyBTaW1wbGVzdCB3YXk6IHJlbW92ZSB1cyBhbmQgdGhlbiByZS1zZW5kIHRoZSBzaWduYWwuXG4gICAgICAvLyBXZSBrbm93IHRoYXQgdGhpcyB3aWxsIGtpbGwgdGhlIHByb2Nlc3MsIHNvIHdlIGNhblxuICAgICAgLy8gc2FmZWx5IGVtaXQgbm93LlxuICAgICAgdmFyIGxpc3RlbmVycyA9IHByb2Nlc3MubGlzdGVuZXJzKHNpZylcbiAgICAgIGlmIChsaXN0ZW5lcnMubGVuZ3RoID09PSBlbWl0dGVyLmNvdW50KSB7XG4gICAgICAgIHVubG9hZCgpXG4gICAgICAgIGVtaXQoJ2V4aXQnLCBudWxsLCBzaWcpXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICAgIGVtaXQoJ2FmdGVyZXhpdCcsIG51bGwsIHNpZylcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgaWYgKGlzV2luICYmIHNpZyA9PT0gJ1NJR0hVUCcpIHtcbiAgICAgICAgICAvLyBcIlNJR0hVUFwiIHRocm93cyBhbiBgRU5PU1lTYCBlcnJvciBvbiBXaW5kb3dzLFxuICAgICAgICAgIC8vIHNvIHVzZSBhIHN1cHBvcnRlZCBzaWduYWwgaW5zdGVhZFxuICAgICAgICAgIHNpZyA9ICdTSUdJTlQnXG4gICAgICAgIH1cbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgcHJvY2Vzcy5raWxsKHByb2Nlc3MucGlkLCBzaWcpXG4gICAgICB9XG4gICAgfVxuICB9KVxuXG4gIG1vZHVsZS5leHBvcnRzLnNpZ25hbHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHNpZ25hbHNcbiAgfVxuXG4gIHZhciBsb2FkZWQgPSBmYWxzZVxuXG4gIHZhciBsb2FkID0gZnVuY3Rpb24gbG9hZCAoKSB7XG4gICAgaWYgKGxvYWRlZCB8fCAhcHJvY2Vzc09rKGdsb2JhbC5wcm9jZXNzKSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGxvYWRlZCA9IHRydWVcblxuICAgIC8vIFRoaXMgaXMgdGhlIG51bWJlciBvZiBvblNpZ25hbEV4aXQncyB0aGF0IGFyZSBpbiBwbGF5LlxuICAgIC8vIEl0J3MgaW1wb3J0YW50IHNvIHRoYXQgd2UgY2FuIGNvdW50IHRoZSBjb3JyZWN0IG51bWJlciBvZlxuICAgIC8vIGxpc3RlbmVycyBvbiBzaWduYWxzLCBhbmQgZG9uJ3Qgd2FpdCBmb3IgdGhlIG90aGVyIG9uZSB0b1xuICAgIC8vIGhhbmRsZSBpdCBpbnN0ZWFkIG9mIHVzLlxuICAgIGVtaXR0ZXIuY291bnQgKz0gMVxuXG4gICAgc2lnbmFscyA9IHNpZ25hbHMuZmlsdGVyKGZ1bmN0aW9uIChzaWcpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHByb2Nlc3Mub24oc2lnLCBzaWdMaXN0ZW5lcnNbc2lnXSlcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH0gY2F0Y2ggKGVyKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgIH0pXG5cbiAgICBwcm9jZXNzLmVtaXQgPSBwcm9jZXNzRW1pdFxuICAgIHByb2Nlc3MucmVhbGx5RXhpdCA9IHByb2Nlc3NSZWFsbHlFeGl0XG4gIH1cbiAgbW9kdWxlLmV4cG9ydHMubG9hZCA9IGxvYWRcblxuICB2YXIgb3JpZ2luYWxQcm9jZXNzUmVhbGx5RXhpdCA9IHByb2Nlc3MucmVhbGx5RXhpdFxuICB2YXIgcHJvY2Vzc1JlYWxseUV4aXQgPSBmdW5jdGlvbiBwcm9jZXNzUmVhbGx5RXhpdCAoY29kZSkge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmICghcHJvY2Vzc09rKGdsb2JhbC5wcm9jZXNzKSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIHByb2Nlc3MuZXhpdENvZGUgPSBjb2RlIHx8IC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovIDBcbiAgICBlbWl0KCdleGl0JywgcHJvY2Vzcy5leGl0Q29kZSwgbnVsbClcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGVtaXQoJ2FmdGVyZXhpdCcsIHByb2Nlc3MuZXhpdENvZGUsIG51bGwpXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBvcmlnaW5hbFByb2Nlc3NSZWFsbHlFeGl0LmNhbGwocHJvY2VzcywgcHJvY2Vzcy5leGl0Q29kZSlcbiAgfVxuXG4gIHZhciBvcmlnaW5hbFByb2Nlc3NFbWl0ID0gcHJvY2Vzcy5lbWl0XG4gIHZhciBwcm9jZXNzRW1pdCA9IGZ1bmN0aW9uIHByb2Nlc3NFbWl0IChldiwgYXJnKSB7XG4gICAgaWYgKGV2ID09PSAnZXhpdCcgJiYgcHJvY2Vzc09rKGdsb2JhbC5wcm9jZXNzKSkge1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICAgIGlmIChhcmcgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwcm9jZXNzLmV4aXRDb2RlID0gYXJnXG4gICAgICB9XG4gICAgICB2YXIgcmV0ID0gb3JpZ2luYWxQcm9jZXNzRW1pdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgZW1pdCgnZXhpdCcsIHByb2Nlc3MuZXhpdENvZGUsIG51bGwpXG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgZW1pdCgnYWZ0ZXJleGl0JywgcHJvY2Vzcy5leGl0Q29kZSwgbnVsbClcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICByZXR1cm4gcmV0XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBvcmlnaW5hbFByb2Nlc3NFbWl0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbiAgICB9XG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcbmNvbnN0IG9zID0gcmVxdWlyZSgnb3MnKTtcbmNvbnN0IG9uRXhpdCA9IHJlcXVpcmUoJ3NpZ25hbC1leGl0Jyk7XG5cbmNvbnN0IERFRkFVTFRfRk9SQ0VfS0lMTF9USU1FT1VUID0gMTAwMCAqIDU7XG5cbi8vIE1vbmtleS1wYXRjaGVzIGBjaGlsZFByb2Nlc3Mua2lsbCgpYCB0byBhZGQgYGZvcmNlS2lsbEFmdGVyVGltZW91dGAgYmVoYXZpb3JcbmNvbnN0IHNwYXduZWRLaWxsID0gKGtpbGwsIHNpZ25hbCA9ICdTSUdURVJNJywgb3B0aW9ucyA9IHt9KSA9PiB7XG5cdGNvbnN0IGtpbGxSZXN1bHQgPSBraWxsKHNpZ25hbCk7XG5cdHNldEtpbGxUaW1lb3V0KGtpbGwsIHNpZ25hbCwgb3B0aW9ucywga2lsbFJlc3VsdCk7XG5cdHJldHVybiBraWxsUmVzdWx0O1xufTtcblxuY29uc3Qgc2V0S2lsbFRpbWVvdXQgPSAoa2lsbCwgc2lnbmFsLCBvcHRpb25zLCBraWxsUmVzdWx0KSA9PiB7XG5cdGlmICghc2hvdWxkRm9yY2VLaWxsKHNpZ25hbCwgb3B0aW9ucywga2lsbFJlc3VsdCkpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRjb25zdCB0aW1lb3V0ID0gZ2V0Rm9yY2VLaWxsQWZ0ZXJUaW1lb3V0KG9wdGlvbnMpO1xuXHRjb25zdCB0ID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0a2lsbCgnU0lHS0lMTCcpO1xuXHR9LCB0aW1lb3V0KTtcblxuXHQvLyBHdWFyZGVkIGJlY2F1c2UgdGhlcmUncyBubyBgLnVucmVmKClgIHdoZW4gYGV4ZWNhYCBpcyB1c2VkIGluIHRoZSByZW5kZXJlclxuXHQvLyBwcm9jZXNzIGluIEVsZWN0cm9uLiBUaGlzIGNhbm5vdCBiZSB0ZXN0ZWQgc2luY2Ugd2UgZG9uJ3QgcnVuIHRlc3RzIGluXG5cdC8vIEVsZWN0cm9uLlxuXHQvLyBpc3RhbmJ1bCBpZ25vcmUgZWxzZVxuXHRpZiAodC51bnJlZikge1xuXHRcdHQudW5yZWYoKTtcblx0fVxufTtcblxuY29uc3Qgc2hvdWxkRm9yY2VLaWxsID0gKHNpZ25hbCwge2ZvcmNlS2lsbEFmdGVyVGltZW91dH0sIGtpbGxSZXN1bHQpID0+IHtcblx0cmV0dXJuIGlzU2lndGVybShzaWduYWwpICYmIGZvcmNlS2lsbEFmdGVyVGltZW91dCAhPT0gZmFsc2UgJiYga2lsbFJlc3VsdDtcbn07XG5cbmNvbnN0IGlzU2lndGVybSA9IHNpZ25hbCA9PiB7XG5cdHJldHVybiBzaWduYWwgPT09IG9zLmNvbnN0YW50cy5zaWduYWxzLlNJR1RFUk0gfHxcblx0XHQodHlwZW9mIHNpZ25hbCA9PT0gJ3N0cmluZycgJiYgc2lnbmFsLnRvVXBwZXJDYXNlKCkgPT09ICdTSUdURVJNJyk7XG59O1xuXG5jb25zdCBnZXRGb3JjZUtpbGxBZnRlclRpbWVvdXQgPSAoe2ZvcmNlS2lsbEFmdGVyVGltZW91dCA9IHRydWV9KSA9PiB7XG5cdGlmIChmb3JjZUtpbGxBZnRlclRpbWVvdXQgPT09IHRydWUpIHtcblx0XHRyZXR1cm4gREVGQVVMVF9GT1JDRV9LSUxMX1RJTUVPVVQ7XG5cdH1cblxuXHRpZiAoIU51bWJlci5pc0Zpbml0ZShmb3JjZUtpbGxBZnRlclRpbWVvdXQpIHx8IGZvcmNlS2lsbEFmdGVyVGltZW91dCA8IDApIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGBFeHBlY3RlZCB0aGUgXFxgZm9yY2VLaWxsQWZ0ZXJUaW1lb3V0XFxgIG9wdGlvbiB0byBiZSBhIG5vbi1uZWdhdGl2ZSBpbnRlZ2VyLCBnb3QgXFxgJHtmb3JjZUtpbGxBZnRlclRpbWVvdXR9XFxgICgke3R5cGVvZiBmb3JjZUtpbGxBZnRlclRpbWVvdXR9KWApO1xuXHR9XG5cblx0cmV0dXJuIGZvcmNlS2lsbEFmdGVyVGltZW91dDtcbn07XG5cbi8vIGBjaGlsZFByb2Nlc3MuY2FuY2VsKClgXG5jb25zdCBzcGF3bmVkQ2FuY2VsID0gKHNwYXduZWQsIGNvbnRleHQpID0+IHtcblx0Y29uc3Qga2lsbFJlc3VsdCA9IHNwYXduZWQua2lsbCgpO1xuXG5cdGlmIChraWxsUmVzdWx0KSB7XG5cdFx0Y29udGV4dC5pc0NhbmNlbGVkID0gdHJ1ZTtcblx0fVxufTtcblxuY29uc3QgdGltZW91dEtpbGwgPSAoc3Bhd25lZCwgc2lnbmFsLCByZWplY3QpID0+IHtcblx0c3Bhd25lZC5raWxsKHNpZ25hbCk7XG5cdHJlamVjdChPYmplY3QuYXNzaWduKG5ldyBFcnJvcignVGltZWQgb3V0JyksIHt0aW1lZE91dDogdHJ1ZSwgc2lnbmFsfSkpO1xufTtcblxuLy8gYHRpbWVvdXRgIG9wdGlvbiBoYW5kbGluZ1xuY29uc3Qgc2V0dXBUaW1lb3V0ID0gKHNwYXduZWQsIHt0aW1lb3V0LCBraWxsU2lnbmFsID0gJ1NJR1RFUk0nfSwgc3Bhd25lZFByb21pc2UpID0+IHtcblx0aWYgKHRpbWVvdXQgPT09IDAgfHwgdGltZW91dCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIHNwYXduZWRQcm9taXNlO1xuXHR9XG5cblx0bGV0IHRpbWVvdXRJZDtcblx0Y29uc3QgdGltZW91dFByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0dGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aW1lb3V0S2lsbChzcGF3bmVkLCBraWxsU2lnbmFsLCByZWplY3QpO1xuXHRcdH0sIHRpbWVvdXQpO1xuXHR9KTtcblxuXHRjb25zdCBzYWZlU3Bhd25lZFByb21pc2UgPSBzcGF3bmVkUHJvbWlzZS5maW5hbGx5KCgpID0+IHtcblx0XHRjbGVhclRpbWVvdXQodGltZW91dElkKTtcblx0fSk7XG5cblx0cmV0dXJuIFByb21pc2UucmFjZShbdGltZW91dFByb21pc2UsIHNhZmVTcGF3bmVkUHJvbWlzZV0pO1xufTtcblxuY29uc3QgdmFsaWRhdGVUaW1lb3V0ID0gKHt0aW1lb3V0fSkgPT4ge1xuXHRpZiAodGltZW91dCAhPT0gdW5kZWZpbmVkICYmICghTnVtYmVyLmlzRmluaXRlKHRpbWVvdXQpIHx8IHRpbWVvdXQgPCAwKSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoYEV4cGVjdGVkIHRoZSBcXGB0aW1lb3V0XFxgIG9wdGlvbiB0byBiZSBhIG5vbi1uZWdhdGl2ZSBpbnRlZ2VyLCBnb3QgXFxgJHt0aW1lb3V0fVxcYCAoJHt0eXBlb2YgdGltZW91dH0pYCk7XG5cdH1cbn07XG5cbi8vIGBjbGVhbnVwYCBvcHRpb24gaGFuZGxpbmdcbmNvbnN0IHNldEV4aXRIYW5kbGVyID0gYXN5bmMgKHNwYXduZWQsIHtjbGVhbnVwLCBkZXRhY2hlZH0sIHRpbWVkUHJvbWlzZSkgPT4ge1xuXHRpZiAoIWNsZWFudXAgfHwgZGV0YWNoZWQpIHtcblx0XHRyZXR1cm4gdGltZWRQcm9taXNlO1xuXHR9XG5cblx0Y29uc3QgcmVtb3ZlRXhpdEhhbmRsZXIgPSBvbkV4aXQoKCkgPT4ge1xuXHRcdHNwYXduZWQua2lsbCgpO1xuXHR9KTtcblxuXHRyZXR1cm4gdGltZWRQcm9taXNlLmZpbmFsbHkoKCkgPT4ge1xuXHRcdHJlbW92ZUV4aXRIYW5kbGVyKCk7XG5cdH0pO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdHNwYXduZWRLaWxsLFxuXHRzcGF3bmVkQ2FuY2VsLFxuXHRzZXR1cFRpbWVvdXQsXG5cdHZhbGlkYXRlVGltZW91dCxcblx0c2V0RXhpdEhhbmRsZXJcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGlzU3RyZWFtID0gc3RyZWFtID0+XG5cdHN0cmVhbSAhPT0gbnVsbCAmJlxuXHR0eXBlb2Ygc3RyZWFtID09PSAnb2JqZWN0JyAmJlxuXHR0eXBlb2Ygc3RyZWFtLnBpcGUgPT09ICdmdW5jdGlvbic7XG5cbmlzU3RyZWFtLndyaXRhYmxlID0gc3RyZWFtID0+XG5cdGlzU3RyZWFtKHN0cmVhbSkgJiZcblx0c3RyZWFtLndyaXRhYmxlICE9PSBmYWxzZSAmJlxuXHR0eXBlb2Ygc3RyZWFtLl93cml0ZSA9PT0gJ2Z1bmN0aW9uJyAmJlxuXHR0eXBlb2Ygc3RyZWFtLl93cml0YWJsZVN0YXRlID09PSAnb2JqZWN0JztcblxuaXNTdHJlYW0ucmVhZGFibGUgPSBzdHJlYW0gPT5cblx0aXNTdHJlYW0oc3RyZWFtKSAmJlxuXHRzdHJlYW0ucmVhZGFibGUgIT09IGZhbHNlICYmXG5cdHR5cGVvZiBzdHJlYW0uX3JlYWQgPT09ICdmdW5jdGlvbicgJiZcblx0dHlwZW9mIHN0cmVhbS5fcmVhZGFibGVTdGF0ZSA9PT0gJ29iamVjdCc7XG5cbmlzU3RyZWFtLmR1cGxleCA9IHN0cmVhbSA9PlxuXHRpc1N0cmVhbS53cml0YWJsZShzdHJlYW0pICYmXG5cdGlzU3RyZWFtLnJlYWRhYmxlKHN0cmVhbSk7XG5cbmlzU3RyZWFtLnRyYW5zZm9ybSA9IHN0cmVhbSA9PlxuXHRpc1N0cmVhbS5kdXBsZXgoc3RyZWFtKSAmJlxuXHR0eXBlb2Ygc3RyZWFtLl90cmFuc2Zvcm0gPT09ICdmdW5jdGlvbic7XG5cbm1vZHVsZS5leHBvcnRzID0gaXNTdHJlYW07XG4iLCIndXNlIHN0cmljdCc7XG5jb25zdCB7UGFzc1Rocm91Z2g6IFBhc3NUaHJvdWdoU3RyZWFtfSA9IHJlcXVpcmUoJ3N0cmVhbScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG9wdGlvbnMgPT4ge1xuXHRvcHRpb25zID0gey4uLm9wdGlvbnN9O1xuXG5cdGNvbnN0IHthcnJheX0gPSBvcHRpb25zO1xuXHRsZXQge2VuY29kaW5nfSA9IG9wdGlvbnM7XG5cdGNvbnN0IGlzQnVmZmVyID0gZW5jb2RpbmcgPT09ICdidWZmZXInO1xuXHRsZXQgb2JqZWN0TW9kZSA9IGZhbHNlO1xuXG5cdGlmIChhcnJheSkge1xuXHRcdG9iamVjdE1vZGUgPSAhKGVuY29kaW5nIHx8IGlzQnVmZmVyKTtcblx0fSBlbHNlIHtcblx0XHRlbmNvZGluZyA9IGVuY29kaW5nIHx8ICd1dGY4Jztcblx0fVxuXG5cdGlmIChpc0J1ZmZlcikge1xuXHRcdGVuY29kaW5nID0gbnVsbDtcblx0fVxuXG5cdGNvbnN0IHN0cmVhbSA9IG5ldyBQYXNzVGhyb3VnaFN0cmVhbSh7b2JqZWN0TW9kZX0pO1xuXG5cdGlmIChlbmNvZGluZykge1xuXHRcdHN0cmVhbS5zZXRFbmNvZGluZyhlbmNvZGluZyk7XG5cdH1cblxuXHRsZXQgbGVuZ3RoID0gMDtcblx0Y29uc3QgY2h1bmtzID0gW107XG5cblx0c3RyZWFtLm9uKCdkYXRhJywgY2h1bmsgPT4ge1xuXHRcdGNodW5rcy5wdXNoKGNodW5rKTtcblxuXHRcdGlmIChvYmplY3RNb2RlKSB7XG5cdFx0XHRsZW5ndGggPSBjaHVua3MubGVuZ3RoO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRsZW5ndGggKz0gY2h1bmsubGVuZ3RoO1xuXHRcdH1cblx0fSk7XG5cblx0c3RyZWFtLmdldEJ1ZmZlcmVkVmFsdWUgPSAoKSA9PiB7XG5cdFx0aWYgKGFycmF5KSB7XG5cdFx0XHRyZXR1cm4gY2h1bmtzO1xuXHRcdH1cblxuXHRcdHJldHVybiBpc0J1ZmZlciA/IEJ1ZmZlci5jb25jYXQoY2h1bmtzLCBsZW5ndGgpIDogY2h1bmtzLmpvaW4oJycpO1xuXHR9O1xuXG5cdHN0cmVhbS5nZXRCdWZmZXJlZExlbmd0aCA9ICgpID0+IGxlbmd0aDtcblxuXHRyZXR1cm4gc3RyZWFtO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcbmNvbnN0IHtjb25zdGFudHM6IEJ1ZmZlckNvbnN0YW50c30gPSByZXF1aXJlKCdidWZmZXInKTtcbmNvbnN0IHN0cmVhbSA9IHJlcXVpcmUoJ3N0cmVhbScpO1xuY29uc3Qge3Byb21pc2lmeX0gPSByZXF1aXJlKCd1dGlsJyk7XG5jb25zdCBidWZmZXJTdHJlYW0gPSByZXF1aXJlKCcuL2J1ZmZlci1zdHJlYW0nKTtcblxuY29uc3Qgc3RyZWFtUGlwZWxpbmVQcm9taXNpZmllZCA9IHByb21pc2lmeShzdHJlYW0ucGlwZWxpbmUpO1xuXG5jbGFzcyBNYXhCdWZmZXJFcnJvciBleHRlbmRzIEVycm9yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoJ21heEJ1ZmZlciBleGNlZWRlZCcpO1xuXHRcdHRoaXMubmFtZSA9ICdNYXhCdWZmZXJFcnJvcic7XG5cdH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0U3RyZWFtKGlucHV0U3RyZWFtLCBvcHRpb25zKSB7XG5cdGlmICghaW5wdXRTdHJlYW0pIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIGEgc3RyZWFtJyk7XG5cdH1cblxuXHRvcHRpb25zID0ge1xuXHRcdG1heEJ1ZmZlcjogSW5maW5pdHksXG5cdFx0Li4ub3B0aW9uc1xuXHR9O1xuXG5cdGNvbnN0IHttYXhCdWZmZXJ9ID0gb3B0aW9ucztcblx0Y29uc3Qgc3RyZWFtID0gYnVmZmVyU3RyZWFtKG9wdGlvbnMpO1xuXG5cdGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRjb25zdCByZWplY3RQcm9taXNlID0gZXJyb3IgPT4ge1xuXHRcdFx0Ly8gRG9uJ3QgcmV0cmlldmUgYW4gb3ZlcnNpemVkIGJ1ZmZlci5cblx0XHRcdGlmIChlcnJvciAmJiBzdHJlYW0uZ2V0QnVmZmVyZWRMZW5ndGgoKSA8PSBCdWZmZXJDb25zdGFudHMuTUFYX0xFTkdUSCkge1xuXHRcdFx0XHRlcnJvci5idWZmZXJlZERhdGEgPSBzdHJlYW0uZ2V0QnVmZmVyZWRWYWx1ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZWplY3QoZXJyb3IpO1xuXHRcdH07XG5cblx0XHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgc3RyZWFtUGlwZWxpbmVQcm9taXNpZmllZChpbnB1dFN0cmVhbSwgc3RyZWFtKTtcblx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0cmVqZWN0UHJvbWlzZShlcnJvcik7XG5cdFx0XHR9XG5cdFx0fSkoKTtcblxuXHRcdHN0cmVhbS5vbignZGF0YScsICgpID0+IHtcblx0XHRcdGlmIChzdHJlYW0uZ2V0QnVmZmVyZWRMZW5ndGgoKSA+IG1heEJ1ZmZlcikge1xuXHRcdFx0XHRyZWplY3RQcm9taXNlKG5ldyBNYXhCdWZmZXJFcnJvcigpKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0cmV0dXJuIHN0cmVhbS5nZXRCdWZmZXJlZFZhbHVlKCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0U3RyZWFtO1xubW9kdWxlLmV4cG9ydHMuYnVmZmVyID0gKHN0cmVhbSwgb3B0aW9ucykgPT4gZ2V0U3RyZWFtKHN0cmVhbSwgey4uLm9wdGlvbnMsIGVuY29kaW5nOiAnYnVmZmVyJ30pO1xubW9kdWxlLmV4cG9ydHMuYXJyYXkgPSAoc3RyZWFtLCBvcHRpb25zKSA9PiBnZXRTdHJlYW0oc3RyZWFtLCB7Li4ub3B0aW9ucywgYXJyYXk6IHRydWV9KTtcbm1vZHVsZS5leHBvcnRzLk1heEJ1ZmZlckVycm9yID0gTWF4QnVmZmVyRXJyb3I7XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IHsgUGFzc1Rocm91Z2ggfSA9IHJlcXVpcmUoJ3N0cmVhbScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgvKnN0cmVhbXMuLi4qLykge1xuICB2YXIgc291cmNlcyA9IFtdXG4gIHZhciBvdXRwdXQgID0gbmV3IFBhc3NUaHJvdWdoKHtvYmplY3RNb2RlOiB0cnVlfSlcblxuICBvdXRwdXQuc2V0TWF4TGlzdGVuZXJzKDApXG5cbiAgb3V0cHV0LmFkZCA9IGFkZFxuICBvdXRwdXQuaXNFbXB0eSA9IGlzRW1wdHlcblxuICBvdXRwdXQub24oJ3VucGlwZScsIHJlbW92ZSlcblxuICBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpLmZvckVhY2goYWRkKVxuXG4gIHJldHVybiBvdXRwdXRcblxuICBmdW5jdGlvbiBhZGQgKHNvdXJjZSkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KHNvdXJjZSkpIHtcbiAgICAgIHNvdXJjZS5mb3JFYWNoKGFkZClcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAgc291cmNlcy5wdXNoKHNvdXJjZSk7XG4gICAgc291cmNlLm9uY2UoJ2VuZCcsIHJlbW92ZS5iaW5kKG51bGwsIHNvdXJjZSkpXG4gICAgc291cmNlLm9uY2UoJ2Vycm9yJywgb3V0cHV0LmVtaXQuYmluZChvdXRwdXQsICdlcnJvcicpKVxuICAgIHNvdXJjZS5waXBlKG91dHB1dCwge2VuZDogZmFsc2V9KVxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBmdW5jdGlvbiBpc0VtcHR5ICgpIHtcbiAgICByZXR1cm4gc291cmNlcy5sZW5ndGggPT0gMDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZSAoc291cmNlKSB7XG4gICAgc291cmNlcyA9IHNvdXJjZXMuZmlsdGVyKGZ1bmN0aW9uIChpdCkgeyByZXR1cm4gaXQgIT09IHNvdXJjZSB9KVxuICAgIGlmICghc291cmNlcy5sZW5ndGggJiYgb3V0cHV0LnJlYWRhYmxlKSB7IG91dHB1dC5lbmQoKSB9XG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcbmNvbnN0IGlzU3RyZWFtID0gcmVxdWlyZSgnaXMtc3RyZWFtJyk7XG5jb25zdCBnZXRTdHJlYW0gPSByZXF1aXJlKCdnZXQtc3RyZWFtJyk7XG5jb25zdCBtZXJnZVN0cmVhbSA9IHJlcXVpcmUoJ21lcmdlLXN0cmVhbScpO1xuXG4vLyBgaW5wdXRgIG9wdGlvblxuY29uc3QgaGFuZGxlSW5wdXQgPSAoc3Bhd25lZCwgaW5wdXQpID0+IHtcblx0Ly8gQ2hlY2tpbmcgZm9yIHN0ZGluIGlzIHdvcmthcm91bmQgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9pc3N1ZXMvMjY4NTJcblx0Ly8gQHRvZG8gcmVtb3ZlIGB8fCBzcGF3bmVkLnN0ZGluID09PSB1bmRlZmluZWRgIG9uY2Ugd2UgZHJvcCBzdXBwb3J0IGZvciBOb2RlLmpzIDw9MTIuMi4wXG5cdGlmIChpbnB1dCA9PT0gdW5kZWZpbmVkIHx8IHNwYXduZWQuc3RkaW4gPT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGlmIChpc1N0cmVhbShpbnB1dCkpIHtcblx0XHRpbnB1dC5waXBlKHNwYXduZWQuc3RkaW4pO1xuXHR9IGVsc2Uge1xuXHRcdHNwYXduZWQuc3RkaW4uZW5kKGlucHV0KTtcblx0fVxufTtcblxuLy8gYGFsbGAgaW50ZXJsZWF2ZXMgYHN0ZG91dGAgYW5kIGBzdGRlcnJgXG5jb25zdCBtYWtlQWxsU3RyZWFtID0gKHNwYXduZWQsIHthbGx9KSA9PiB7XG5cdGlmICghYWxsIHx8ICghc3Bhd25lZC5zdGRvdXQgJiYgIXNwYXduZWQuc3RkZXJyKSkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IG1peGVkID0gbWVyZ2VTdHJlYW0oKTtcblxuXHRpZiAoc3Bhd25lZC5zdGRvdXQpIHtcblx0XHRtaXhlZC5hZGQoc3Bhd25lZC5zdGRvdXQpO1xuXHR9XG5cblx0aWYgKHNwYXduZWQuc3RkZXJyKSB7XG5cdFx0bWl4ZWQuYWRkKHNwYXduZWQuc3RkZXJyKTtcblx0fVxuXG5cdHJldHVybiBtaXhlZDtcbn07XG5cbi8vIE9uIGZhaWx1cmUsIGByZXN1bHQuc3Rkb3V0fHN0ZGVycnxhbGxgIHNob3VsZCBjb250YWluIHRoZSBjdXJyZW50bHkgYnVmZmVyZWQgc3RyZWFtXG5jb25zdCBnZXRCdWZmZXJlZERhdGEgPSBhc3luYyAoc3RyZWFtLCBzdHJlYW1Qcm9taXNlKSA9PiB7XG5cdGlmICghc3RyZWFtKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0c3RyZWFtLmRlc3Ryb3koKTtcblxuXHR0cnkge1xuXHRcdHJldHVybiBhd2FpdCBzdHJlYW1Qcm9taXNlO1xuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdHJldHVybiBlcnJvci5idWZmZXJlZERhdGE7XG5cdH1cbn07XG5cbmNvbnN0IGdldFN0cmVhbVByb21pc2UgPSAoc3RyZWFtLCB7ZW5jb2RpbmcsIGJ1ZmZlciwgbWF4QnVmZmVyfSkgPT4ge1xuXHRpZiAoIXN0cmVhbSB8fCAhYnVmZmVyKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0aWYgKGVuY29kaW5nKSB7XG5cdFx0cmV0dXJuIGdldFN0cmVhbShzdHJlYW0sIHtlbmNvZGluZywgbWF4QnVmZmVyfSk7XG5cdH1cblxuXHRyZXR1cm4gZ2V0U3RyZWFtLmJ1ZmZlcihzdHJlYW0sIHttYXhCdWZmZXJ9KTtcbn07XG5cbi8vIFJldHJpZXZlIHJlc3VsdCBvZiBjaGlsZCBwcm9jZXNzOiBleGl0IGNvZGUsIHNpZ25hbCwgZXJyb3IsIHN0cmVhbXMgKHN0ZG91dC9zdGRlcnIvYWxsKVxuY29uc3QgZ2V0U3Bhd25lZFJlc3VsdCA9IGFzeW5jICh7c3Rkb3V0LCBzdGRlcnIsIGFsbH0sIHtlbmNvZGluZywgYnVmZmVyLCBtYXhCdWZmZXJ9LCBwcm9jZXNzRG9uZSkgPT4ge1xuXHRjb25zdCBzdGRvdXRQcm9taXNlID0gZ2V0U3RyZWFtUHJvbWlzZShzdGRvdXQsIHtlbmNvZGluZywgYnVmZmVyLCBtYXhCdWZmZXJ9KTtcblx0Y29uc3Qgc3RkZXJyUHJvbWlzZSA9IGdldFN0cmVhbVByb21pc2Uoc3RkZXJyLCB7ZW5jb2RpbmcsIGJ1ZmZlciwgbWF4QnVmZmVyfSk7XG5cdGNvbnN0IGFsbFByb21pc2UgPSBnZXRTdHJlYW1Qcm9taXNlKGFsbCwge2VuY29kaW5nLCBidWZmZXIsIG1heEJ1ZmZlcjogbWF4QnVmZmVyICogMn0pO1xuXG5cdHRyeSB7XG5cdFx0cmV0dXJuIGF3YWl0IFByb21pc2UuYWxsKFtwcm9jZXNzRG9uZSwgc3Rkb3V0UHJvbWlzZSwgc3RkZXJyUHJvbWlzZSwgYWxsUHJvbWlzZV0pO1xuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdHJldHVybiBQcm9taXNlLmFsbChbXG5cdFx0XHR7ZXJyb3IsIHNpZ25hbDogZXJyb3Iuc2lnbmFsLCB0aW1lZE91dDogZXJyb3IudGltZWRPdXR9LFxuXHRcdFx0Z2V0QnVmZmVyZWREYXRhKHN0ZG91dCwgc3Rkb3V0UHJvbWlzZSksXG5cdFx0XHRnZXRCdWZmZXJlZERhdGEoc3RkZXJyLCBzdGRlcnJQcm9taXNlKSxcblx0XHRcdGdldEJ1ZmZlcmVkRGF0YShhbGwsIGFsbFByb21pc2UpXG5cdFx0XSk7XG5cdH1cbn07XG5cbmNvbnN0IHZhbGlkYXRlSW5wdXRTeW5jID0gKHtpbnB1dH0pID0+IHtcblx0aWYgKGlzU3RyZWFtKGlucHV0KSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBgaW5wdXRgIG9wdGlvbiBjYW5ub3QgYmUgYSBzdHJlYW0gaW4gc3luYyBtb2RlJyk7XG5cdH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRoYW5kbGVJbnB1dCxcblx0bWFrZUFsbFN0cmVhbSxcblx0Z2V0U3Bhd25lZFJlc3VsdCxcblx0dmFsaWRhdGVJbnB1dFN5bmNcbn07XG5cbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgbmF0aXZlUHJvbWlzZVByb3RvdHlwZSA9IChhc3luYyAoKSA9PiB7fSkoKS5jb25zdHJ1Y3Rvci5wcm90b3R5cGU7XG5jb25zdCBkZXNjcmlwdG9ycyA9IFsndGhlbicsICdjYXRjaCcsICdmaW5hbGx5J10ubWFwKHByb3BlcnR5ID0+IFtcblx0cHJvcGVydHksXG5cdFJlZmxlY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG5hdGl2ZVByb21pc2VQcm90b3R5cGUsIHByb3BlcnR5KVxuXSk7XG5cbi8vIFRoZSByZXR1cm4gdmFsdWUgaXMgYSBtaXhpbiBvZiBgY2hpbGRQcm9jZXNzYCBhbmQgYFByb21pc2VgXG5jb25zdCBtZXJnZVByb21pc2UgPSAoc3Bhd25lZCwgcHJvbWlzZSkgPT4ge1xuXHRmb3IgKGNvbnN0IFtwcm9wZXJ0eSwgZGVzY3JpcHRvcl0gb2YgZGVzY3JpcHRvcnMpIHtcblx0XHQvLyBTdGFydGluZyB0aGUgbWFpbiBgcHJvbWlzZWAgaXMgZGVmZXJyZWQgdG8gYXZvaWQgY29uc3VtaW5nIHN0cmVhbXNcblx0XHRjb25zdCB2YWx1ZSA9IHR5cGVvZiBwcm9taXNlID09PSAnZnVuY3Rpb24nID9cblx0XHRcdCguLi5hcmdzKSA9PiBSZWZsZWN0LmFwcGx5KGRlc2NyaXB0b3IudmFsdWUsIHByb21pc2UoKSwgYXJncykgOlxuXHRcdFx0ZGVzY3JpcHRvci52YWx1ZS5iaW5kKHByb21pc2UpO1xuXG5cdFx0UmVmbGVjdC5kZWZpbmVQcm9wZXJ0eShzcGF3bmVkLCBwcm9wZXJ0eSwgey4uLmRlc2NyaXB0b3IsIHZhbHVlfSk7XG5cdH1cblxuXHRyZXR1cm4gc3Bhd25lZDtcbn07XG5cbi8vIFVzZSBwcm9taXNlcyBpbnN0ZWFkIG9mIGBjaGlsZF9wcm9jZXNzYCBldmVudHNcbmNvbnN0IGdldFNwYXduZWRQcm9taXNlID0gc3Bhd25lZCA9PiB7XG5cdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0c3Bhd25lZC5vbignZXhpdCcsIChleGl0Q29kZSwgc2lnbmFsKSA9PiB7XG5cdFx0XHRyZXNvbHZlKHtleGl0Q29kZSwgc2lnbmFsfSk7XG5cdFx0fSk7XG5cblx0XHRzcGF3bmVkLm9uKCdlcnJvcicsIGVycm9yID0+IHtcblx0XHRcdHJlamVjdChlcnJvcik7XG5cdFx0fSk7XG5cblx0XHRpZiAoc3Bhd25lZC5zdGRpbikge1xuXHRcdFx0c3Bhd25lZC5zdGRpbi5vbignZXJyb3InLCBlcnJvciA9PiB7XG5cdFx0XHRcdHJlamVjdChlcnJvcik7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdG1lcmdlUHJvbWlzZSxcblx0Z2V0U3Bhd25lZFByb21pc2Vcbn07XG5cbiIsIid1c2Ugc3RyaWN0JztcbmNvbnN0IG5vcm1hbGl6ZUFyZ3MgPSAoZmlsZSwgYXJncyA9IFtdKSA9PiB7XG5cdGlmICghQXJyYXkuaXNBcnJheShhcmdzKSkge1xuXHRcdHJldHVybiBbZmlsZV07XG5cdH1cblxuXHRyZXR1cm4gW2ZpbGUsIC4uLmFyZ3NdO1xufTtcblxuY29uc3QgTk9fRVNDQVBFX1JFR0VYUCA9IC9eW1xcdy4tXSskLztcbmNvbnN0IERPVUJMRV9RVU9URVNfUkVHRVhQID0gL1wiL2c7XG5cbmNvbnN0IGVzY2FwZUFyZyA9IGFyZyA9PiB7XG5cdGlmICh0eXBlb2YgYXJnICE9PSAnc3RyaW5nJyB8fCBOT19FU0NBUEVfUkVHRVhQLnRlc3QoYXJnKSkge1xuXHRcdHJldHVybiBhcmc7XG5cdH1cblxuXHRyZXR1cm4gYFwiJHthcmcucmVwbGFjZShET1VCTEVfUVVPVEVTX1JFR0VYUCwgJ1xcXFxcIicpfVwiYDtcbn07XG5cbmNvbnN0IGpvaW5Db21tYW5kID0gKGZpbGUsIGFyZ3MpID0+IHtcblx0cmV0dXJuIG5vcm1hbGl6ZUFyZ3MoZmlsZSwgYXJncykuam9pbignICcpO1xufTtcblxuY29uc3QgZ2V0RXNjYXBlZENvbW1hbmQgPSAoZmlsZSwgYXJncykgPT4ge1xuXHRyZXR1cm4gbm9ybWFsaXplQXJncyhmaWxlLCBhcmdzKS5tYXAoYXJnID0+IGVzY2FwZUFyZyhhcmcpKS5qb2luKCcgJyk7XG59O1xuXG5jb25zdCBTUEFDRVNfUkVHRVhQID0gLyArL2c7XG5cbi8vIEhhbmRsZSBgZXhlY2EuY29tbWFuZCgpYFxuY29uc3QgcGFyc2VDb21tYW5kID0gY29tbWFuZCA9PiB7XG5cdGNvbnN0IHRva2VucyA9IFtdO1xuXHRmb3IgKGNvbnN0IHRva2VuIG9mIGNvbW1hbmQudHJpbSgpLnNwbGl0KFNQQUNFU19SRUdFWFApKSB7XG5cdFx0Ly8gQWxsb3cgc3BhY2VzIHRvIGJlIGVzY2FwZWQgYnkgYSBiYWNrc2xhc2ggaWYgbm90IG1lYW50IGFzIGEgZGVsaW1pdGVyXG5cdFx0Y29uc3QgcHJldmlvdXNUb2tlbiA9IHRva2Vuc1t0b2tlbnMubGVuZ3RoIC0gMV07XG5cdFx0aWYgKHByZXZpb3VzVG9rZW4gJiYgcHJldmlvdXNUb2tlbi5lbmRzV2l0aCgnXFxcXCcpKSB7XG5cdFx0XHQvLyBNZXJnZSBwcmV2aW91cyB0b2tlbiB3aXRoIGN1cnJlbnQgb25lXG5cdFx0XHR0b2tlbnNbdG9rZW5zLmxlbmd0aCAtIDFdID0gYCR7cHJldmlvdXNUb2tlbi5zbGljZSgwLCAtMSl9ICR7dG9rZW59YDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dG9rZW5zLnB1c2godG9rZW4pO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB0b2tlbnM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0am9pbkNvbW1hbmQsXG5cdGdldEVzY2FwZWRDb21tYW5kLFxuXHRwYXJzZUNvbW1hbmRcbn07XG4iLCIndXNlIHN0cmljdCc7XG5jb25zdCBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xuY29uc3QgY2hpbGRQcm9jZXNzID0gcmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpO1xuY29uc3QgY3Jvc3NTcGF3biA9IHJlcXVpcmUoJ2Nyb3NzLXNwYXduJyk7XG5jb25zdCBzdHJpcEZpbmFsTmV3bGluZSA9IHJlcXVpcmUoJ3N0cmlwLWZpbmFsLW5ld2xpbmUnKTtcbmNvbnN0IG5wbVJ1blBhdGggPSByZXF1aXJlKCducG0tcnVuLXBhdGgnKTtcbmNvbnN0IG9uZXRpbWUgPSByZXF1aXJlKCdvbmV0aW1lJyk7XG5jb25zdCBtYWtlRXJyb3IgPSByZXF1aXJlKCcuL2xpYi9lcnJvcicpO1xuY29uc3Qgbm9ybWFsaXplU3RkaW8gPSByZXF1aXJlKCcuL2xpYi9zdGRpbycpO1xuY29uc3Qge3NwYXduZWRLaWxsLCBzcGF3bmVkQ2FuY2VsLCBzZXR1cFRpbWVvdXQsIHZhbGlkYXRlVGltZW91dCwgc2V0RXhpdEhhbmRsZXJ9ID0gcmVxdWlyZSgnLi9saWIva2lsbCcpO1xuY29uc3Qge2hhbmRsZUlucHV0LCBnZXRTcGF3bmVkUmVzdWx0LCBtYWtlQWxsU3RyZWFtLCB2YWxpZGF0ZUlucHV0U3luY30gPSByZXF1aXJlKCcuL2xpYi9zdHJlYW0nKTtcbmNvbnN0IHttZXJnZVByb21pc2UsIGdldFNwYXduZWRQcm9taXNlfSA9IHJlcXVpcmUoJy4vbGliL3Byb21pc2UnKTtcbmNvbnN0IHtqb2luQ29tbWFuZCwgcGFyc2VDb21tYW5kLCBnZXRFc2NhcGVkQ29tbWFuZH0gPSByZXF1aXJlKCcuL2xpYi9jb21tYW5kJyk7XG5cbmNvbnN0IERFRkFVTFRfTUFYX0JVRkZFUiA9IDEwMDAgKiAxMDAwICogMTAwO1xuXG5jb25zdCBnZXRFbnYgPSAoe2VudjogZW52T3B0aW9uLCBleHRlbmRFbnYsIHByZWZlckxvY2FsLCBsb2NhbERpciwgZXhlY1BhdGh9KSA9PiB7XG5cdGNvbnN0IGVudiA9IGV4dGVuZEVudiA/IHsuLi5wcm9jZXNzLmVudiwgLi4uZW52T3B0aW9ufSA6IGVudk9wdGlvbjtcblxuXHRpZiAocHJlZmVyTG9jYWwpIHtcblx0XHRyZXR1cm4gbnBtUnVuUGF0aC5lbnYoe2VudiwgY3dkOiBsb2NhbERpciwgZXhlY1BhdGh9KTtcblx0fVxuXG5cdHJldHVybiBlbnY7XG59O1xuXG5jb25zdCBoYW5kbGVBcmd1bWVudHMgPSAoZmlsZSwgYXJncywgb3B0aW9ucyA9IHt9KSA9PiB7XG5cdGNvbnN0IHBhcnNlZCA9IGNyb3NzU3Bhd24uX3BhcnNlKGZpbGUsIGFyZ3MsIG9wdGlvbnMpO1xuXHRmaWxlID0gcGFyc2VkLmNvbW1hbmQ7XG5cdGFyZ3MgPSBwYXJzZWQuYXJncztcblx0b3B0aW9ucyA9IHBhcnNlZC5vcHRpb25zO1xuXG5cdG9wdGlvbnMgPSB7XG5cdFx0bWF4QnVmZmVyOiBERUZBVUxUX01BWF9CVUZGRVIsXG5cdFx0YnVmZmVyOiB0cnVlLFxuXHRcdHN0cmlwRmluYWxOZXdsaW5lOiB0cnVlLFxuXHRcdGV4dGVuZEVudjogdHJ1ZSxcblx0XHRwcmVmZXJMb2NhbDogZmFsc2UsXG5cdFx0bG9jYWxEaXI6IG9wdGlvbnMuY3dkIHx8IHByb2Nlc3MuY3dkKCksXG5cdFx0ZXhlY1BhdGg6IHByb2Nlc3MuZXhlY1BhdGgsXG5cdFx0ZW5jb2Rpbmc6ICd1dGY4Jyxcblx0XHRyZWplY3Q6IHRydWUsXG5cdFx0Y2xlYW51cDogdHJ1ZSxcblx0XHRhbGw6IGZhbHNlLFxuXHRcdHdpbmRvd3NIaWRlOiB0cnVlLFxuXHRcdC4uLm9wdGlvbnNcblx0fTtcblxuXHRvcHRpb25zLmVudiA9IGdldEVudihvcHRpb25zKTtcblxuXHRvcHRpb25zLnN0ZGlvID0gbm9ybWFsaXplU3RkaW8ob3B0aW9ucyk7XG5cblx0aWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicgJiYgcGF0aC5iYXNlbmFtZShmaWxlLCAnLmV4ZScpID09PSAnY21kJykge1xuXHRcdC8vICMxMTZcblx0XHRhcmdzLnVuc2hpZnQoJy9xJyk7XG5cdH1cblxuXHRyZXR1cm4ge2ZpbGUsIGFyZ3MsIG9wdGlvbnMsIHBhcnNlZH07XG59O1xuXG5jb25zdCBoYW5kbGVPdXRwdXQgPSAob3B0aW9ucywgdmFsdWUsIGVycm9yKSA9PiB7XG5cdGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnICYmICFCdWZmZXIuaXNCdWZmZXIodmFsdWUpKSB7XG5cdFx0Ly8gV2hlbiBgZXhlY2Euc3luYygpYCBlcnJvcnMsIHdlIG5vcm1hbGl6ZSBpdCB0byAnJyB0byBtaW1pYyBgZXhlY2EoKWBcblx0XHRyZXR1cm4gZXJyb3IgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6ICcnO1xuXHR9XG5cblx0aWYgKG9wdGlvbnMuc3RyaXBGaW5hbE5ld2xpbmUpIHtcblx0XHRyZXR1cm4gc3RyaXBGaW5hbE5ld2xpbmUodmFsdWUpO1xuXHR9XG5cblx0cmV0dXJuIHZhbHVlO1xufTtcblxuY29uc3QgZXhlY2EgPSAoZmlsZSwgYXJncywgb3B0aW9ucykgPT4ge1xuXHRjb25zdCBwYXJzZWQgPSBoYW5kbGVBcmd1bWVudHMoZmlsZSwgYXJncywgb3B0aW9ucyk7XG5cdGNvbnN0IGNvbW1hbmQgPSBqb2luQ29tbWFuZChmaWxlLCBhcmdzKTtcblx0Y29uc3QgZXNjYXBlZENvbW1hbmQgPSBnZXRFc2NhcGVkQ29tbWFuZChmaWxlLCBhcmdzKTtcblxuXHR2YWxpZGF0ZVRpbWVvdXQocGFyc2VkLm9wdGlvbnMpO1xuXG5cdGxldCBzcGF3bmVkO1xuXHR0cnkge1xuXHRcdHNwYXduZWQgPSBjaGlsZFByb2Nlc3Muc3Bhd24ocGFyc2VkLmZpbGUsIHBhcnNlZC5hcmdzLCBwYXJzZWQub3B0aW9ucyk7XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0Ly8gRW5zdXJlIHRoZSByZXR1cm5lZCBlcnJvciBpcyBhbHdheXMgYm90aCBhIHByb21pc2UgYW5kIGEgY2hpbGQgcHJvY2Vzc1xuXHRcdGNvbnN0IGR1bW15U3Bhd25lZCA9IG5ldyBjaGlsZFByb2Nlc3MuQ2hpbGRQcm9jZXNzKCk7XG5cdFx0Y29uc3QgZXJyb3JQcm9taXNlID0gUHJvbWlzZS5yZWplY3QobWFrZUVycm9yKHtcblx0XHRcdGVycm9yLFxuXHRcdFx0c3Rkb3V0OiAnJyxcblx0XHRcdHN0ZGVycjogJycsXG5cdFx0XHRhbGw6ICcnLFxuXHRcdFx0Y29tbWFuZCxcblx0XHRcdGVzY2FwZWRDb21tYW5kLFxuXHRcdFx0cGFyc2VkLFxuXHRcdFx0dGltZWRPdXQ6IGZhbHNlLFxuXHRcdFx0aXNDYW5jZWxlZDogZmFsc2UsXG5cdFx0XHRraWxsZWQ6IGZhbHNlXG5cdFx0fSkpO1xuXHRcdHJldHVybiBtZXJnZVByb21pc2UoZHVtbXlTcGF3bmVkLCBlcnJvclByb21pc2UpO1xuXHR9XG5cblx0Y29uc3Qgc3Bhd25lZFByb21pc2UgPSBnZXRTcGF3bmVkUHJvbWlzZShzcGF3bmVkKTtcblx0Y29uc3QgdGltZWRQcm9taXNlID0gc2V0dXBUaW1lb3V0KHNwYXduZWQsIHBhcnNlZC5vcHRpb25zLCBzcGF3bmVkUHJvbWlzZSk7XG5cdGNvbnN0IHByb2Nlc3NEb25lID0gc2V0RXhpdEhhbmRsZXIoc3Bhd25lZCwgcGFyc2VkLm9wdGlvbnMsIHRpbWVkUHJvbWlzZSk7XG5cblx0Y29uc3QgY29udGV4dCA9IHtpc0NhbmNlbGVkOiBmYWxzZX07XG5cblx0c3Bhd25lZC5raWxsID0gc3Bhd25lZEtpbGwuYmluZChudWxsLCBzcGF3bmVkLmtpbGwuYmluZChzcGF3bmVkKSk7XG5cdHNwYXduZWQuY2FuY2VsID0gc3Bhd25lZENhbmNlbC5iaW5kKG51bGwsIHNwYXduZWQsIGNvbnRleHQpO1xuXG5cdGNvbnN0IGhhbmRsZVByb21pc2UgPSBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgW3tlcnJvciwgZXhpdENvZGUsIHNpZ25hbCwgdGltZWRPdXR9LCBzdGRvdXRSZXN1bHQsIHN0ZGVyclJlc3VsdCwgYWxsUmVzdWx0XSA9IGF3YWl0IGdldFNwYXduZWRSZXN1bHQoc3Bhd25lZCwgcGFyc2VkLm9wdGlvbnMsIHByb2Nlc3NEb25lKTtcblx0XHRjb25zdCBzdGRvdXQgPSBoYW5kbGVPdXRwdXQocGFyc2VkLm9wdGlvbnMsIHN0ZG91dFJlc3VsdCk7XG5cdFx0Y29uc3Qgc3RkZXJyID0gaGFuZGxlT3V0cHV0KHBhcnNlZC5vcHRpb25zLCBzdGRlcnJSZXN1bHQpO1xuXHRcdGNvbnN0IGFsbCA9IGhhbmRsZU91dHB1dChwYXJzZWQub3B0aW9ucywgYWxsUmVzdWx0KTtcblxuXHRcdGlmIChlcnJvciB8fCBleGl0Q29kZSAhPT0gMCB8fCBzaWduYWwgIT09IG51bGwpIHtcblx0XHRcdGNvbnN0IHJldHVybmVkRXJyb3IgPSBtYWtlRXJyb3Ioe1xuXHRcdFx0XHRlcnJvcixcblx0XHRcdFx0ZXhpdENvZGUsXG5cdFx0XHRcdHNpZ25hbCxcblx0XHRcdFx0c3Rkb3V0LFxuXHRcdFx0XHRzdGRlcnIsXG5cdFx0XHRcdGFsbCxcblx0XHRcdFx0Y29tbWFuZCxcblx0XHRcdFx0ZXNjYXBlZENvbW1hbmQsXG5cdFx0XHRcdHBhcnNlZCxcblx0XHRcdFx0dGltZWRPdXQsXG5cdFx0XHRcdGlzQ2FuY2VsZWQ6IGNvbnRleHQuaXNDYW5jZWxlZCxcblx0XHRcdFx0a2lsbGVkOiBzcGF3bmVkLmtpbGxlZFxuXHRcdFx0fSk7XG5cblx0XHRcdGlmICghcGFyc2VkLm9wdGlvbnMucmVqZWN0KSB7XG5cdFx0XHRcdHJldHVybiByZXR1cm5lZEVycm9yO1xuXHRcdFx0fVxuXG5cdFx0XHR0aHJvdyByZXR1cm5lZEVycm9yO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRjb21tYW5kLFxuXHRcdFx0ZXNjYXBlZENvbW1hbmQsXG5cdFx0XHRleGl0Q29kZTogMCxcblx0XHRcdHN0ZG91dCxcblx0XHRcdHN0ZGVycixcblx0XHRcdGFsbCxcblx0XHRcdGZhaWxlZDogZmFsc2UsXG5cdFx0XHR0aW1lZE91dDogZmFsc2UsXG5cdFx0XHRpc0NhbmNlbGVkOiBmYWxzZSxcblx0XHRcdGtpbGxlZDogZmFsc2Vcblx0XHR9O1xuXHR9O1xuXG5cdGNvbnN0IGhhbmRsZVByb21pc2VPbmNlID0gb25ldGltZShoYW5kbGVQcm9taXNlKTtcblxuXHRoYW5kbGVJbnB1dChzcGF3bmVkLCBwYXJzZWQub3B0aW9ucy5pbnB1dCk7XG5cblx0c3Bhd25lZC5hbGwgPSBtYWtlQWxsU3RyZWFtKHNwYXduZWQsIHBhcnNlZC5vcHRpb25zKTtcblxuXHRyZXR1cm4gbWVyZ2VQcm9taXNlKHNwYXduZWQsIGhhbmRsZVByb21pc2VPbmNlKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZXhlY2E7XG5cbm1vZHVsZS5leHBvcnRzLnN5bmMgPSAoZmlsZSwgYXJncywgb3B0aW9ucykgPT4ge1xuXHRjb25zdCBwYXJzZWQgPSBoYW5kbGVBcmd1bWVudHMoZmlsZSwgYXJncywgb3B0aW9ucyk7XG5cdGNvbnN0IGNvbW1hbmQgPSBqb2luQ29tbWFuZChmaWxlLCBhcmdzKTtcblx0Y29uc3QgZXNjYXBlZENvbW1hbmQgPSBnZXRFc2NhcGVkQ29tbWFuZChmaWxlLCBhcmdzKTtcblxuXHR2YWxpZGF0ZUlucHV0U3luYyhwYXJzZWQub3B0aW9ucyk7XG5cblx0bGV0IHJlc3VsdDtcblx0dHJ5IHtcblx0XHRyZXN1bHQgPSBjaGlsZFByb2Nlc3Muc3Bhd25TeW5jKHBhcnNlZC5maWxlLCBwYXJzZWQuYXJncywgcGFyc2VkLm9wdGlvbnMpO1xuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdHRocm93IG1ha2VFcnJvcih7XG5cdFx0XHRlcnJvcixcblx0XHRcdHN0ZG91dDogJycsXG5cdFx0XHRzdGRlcnI6ICcnLFxuXHRcdFx0YWxsOiAnJyxcblx0XHRcdGNvbW1hbmQsXG5cdFx0XHRlc2NhcGVkQ29tbWFuZCxcblx0XHRcdHBhcnNlZCxcblx0XHRcdHRpbWVkT3V0OiBmYWxzZSxcblx0XHRcdGlzQ2FuY2VsZWQ6IGZhbHNlLFxuXHRcdFx0a2lsbGVkOiBmYWxzZVxuXHRcdH0pO1xuXHR9XG5cblx0Y29uc3Qgc3Rkb3V0ID0gaGFuZGxlT3V0cHV0KHBhcnNlZC5vcHRpb25zLCByZXN1bHQuc3Rkb3V0LCByZXN1bHQuZXJyb3IpO1xuXHRjb25zdCBzdGRlcnIgPSBoYW5kbGVPdXRwdXQocGFyc2VkLm9wdGlvbnMsIHJlc3VsdC5zdGRlcnIsIHJlc3VsdC5lcnJvcik7XG5cblx0aWYgKHJlc3VsdC5lcnJvciB8fCByZXN1bHQuc3RhdHVzICE9PSAwIHx8IHJlc3VsdC5zaWduYWwgIT09IG51bGwpIHtcblx0XHRjb25zdCBlcnJvciA9IG1ha2VFcnJvcih7XG5cdFx0XHRzdGRvdXQsXG5cdFx0XHRzdGRlcnIsXG5cdFx0XHRlcnJvcjogcmVzdWx0LmVycm9yLFxuXHRcdFx0c2lnbmFsOiByZXN1bHQuc2lnbmFsLFxuXHRcdFx0ZXhpdENvZGU6IHJlc3VsdC5zdGF0dXMsXG5cdFx0XHRjb21tYW5kLFxuXHRcdFx0ZXNjYXBlZENvbW1hbmQsXG5cdFx0XHRwYXJzZWQsXG5cdFx0XHR0aW1lZE91dDogcmVzdWx0LmVycm9yICYmIHJlc3VsdC5lcnJvci5jb2RlID09PSAnRVRJTUVET1VUJyxcblx0XHRcdGlzQ2FuY2VsZWQ6IGZhbHNlLFxuXHRcdFx0a2lsbGVkOiByZXN1bHQuc2lnbmFsICE9PSBudWxsXG5cdFx0fSk7XG5cblx0XHRpZiAoIXBhcnNlZC5vcHRpb25zLnJlamVjdCkge1xuXHRcdFx0cmV0dXJuIGVycm9yO1xuXHRcdH1cblxuXHRcdHRocm93IGVycm9yO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRjb21tYW5kLFxuXHRcdGVzY2FwZWRDb21tYW5kLFxuXHRcdGV4aXRDb2RlOiAwLFxuXHRcdHN0ZG91dCxcblx0XHRzdGRlcnIsXG5cdFx0ZmFpbGVkOiBmYWxzZSxcblx0XHR0aW1lZE91dDogZmFsc2UsXG5cdFx0aXNDYW5jZWxlZDogZmFsc2UsXG5cdFx0a2lsbGVkOiBmYWxzZVxuXHR9O1xufTtcblxubW9kdWxlLmV4cG9ydHMuY29tbWFuZCA9IChjb21tYW5kLCBvcHRpb25zKSA9PiB7XG5cdGNvbnN0IFtmaWxlLCAuLi5hcmdzXSA9IHBhcnNlQ29tbWFuZChjb21tYW5kKTtcblx0cmV0dXJuIGV4ZWNhKGZpbGUsIGFyZ3MsIG9wdGlvbnMpO1xufTtcblxubW9kdWxlLmV4cG9ydHMuY29tbWFuZFN5bmMgPSAoY29tbWFuZCwgb3B0aW9ucykgPT4ge1xuXHRjb25zdCBbZmlsZSwgLi4uYXJnc10gPSBwYXJzZUNvbW1hbmQoY29tbWFuZCk7XG5cdHJldHVybiBleGVjYS5zeW5jKGZpbGUsIGFyZ3MsIG9wdGlvbnMpO1xufTtcblxubW9kdWxlLmV4cG9ydHMubm9kZSA9IChzY3JpcHRQYXRoLCBhcmdzLCBvcHRpb25zID0ge30pID0+IHtcblx0aWYgKGFyZ3MgJiYgIUFycmF5LmlzQXJyYXkoYXJncykgJiYgdHlwZW9mIGFyZ3MgPT09ICdvYmplY3QnKSB7XG5cdFx0b3B0aW9ucyA9IGFyZ3M7XG5cdFx0YXJncyA9IFtdO1xuXHR9XG5cblx0Y29uc3Qgc3RkaW8gPSBub3JtYWxpemVTdGRpby5ub2RlKG9wdGlvbnMpO1xuXHRjb25zdCBkZWZhdWx0RXhlY0FyZ3YgPSBwcm9jZXNzLmV4ZWNBcmd2LmZpbHRlcihhcmcgPT4gIWFyZy5zdGFydHNXaXRoKCctLWluc3BlY3QnKSk7XG5cblx0Y29uc3Qge1xuXHRcdG5vZGVQYXRoID0gcHJvY2Vzcy5leGVjUGF0aCxcblx0XHRub2RlT3B0aW9ucyA9IGRlZmF1bHRFeGVjQXJndlxuXHR9ID0gb3B0aW9ucztcblxuXHRyZXR1cm4gZXhlY2EoXG5cdFx0bm9kZVBhdGgsXG5cdFx0W1xuXHRcdFx0Li4ubm9kZU9wdGlvbnMsXG5cdFx0XHRzY3JpcHRQYXRoLFxuXHRcdFx0Li4uKEFycmF5LmlzQXJyYXkoYXJncykgPyBhcmdzIDogW10pXG5cdFx0XSxcblx0XHR7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0c3RkaW46IHVuZGVmaW5lZCxcblx0XHRcdHN0ZG91dDogdW5kZWZpbmVkLFxuXHRcdFx0c3RkZXJyOiB1bmRlZmluZWQsXG5cdFx0XHRzdGRpbyxcblx0XHRcdHNoZWxsOiBmYWxzZVxuXHRcdH1cblx0KTtcbn07XG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhbnNpUmVnZXgoe29ubHlGaXJzdCA9IGZhbHNlfSA9IHt9KSB7XG5cdC8vIFZhbGlkIHN0cmluZyB0ZXJtaW5hdG9yIHNlcXVlbmNlcyBhcmUgQkVMLCBFU0NcXCwgYW5kIDB4OWNcblx0Y29uc3QgU1QgPSAnKD86XFxcXHUwMDA3fFxcXFx1MDAxQlxcXFx1MDA1Q3xcXFxcdTAwOUMpJztcblx0Y29uc3QgcGF0dGVybiA9IFtcblx0XHRgW1xcXFx1MDAxQlxcXFx1MDA5Ql1bW1xcXFxdKCkjOz9dKig/Oig/Oig/Oig/OjtbLWEtekEtWlxcXFxkXFxcXC8jJi46PT8lQH5fXSspKnxbYS16QS1aXFxcXGRdKyg/OjtbLWEtekEtWlxcXFxkXFxcXC8jJi46PT8lQH5fXSopKik/JHtTVH0pYCxcblx0XHQnKD86KD86XFxcXGR7MSw0fSg/OjtcXFxcZHswLDR9KSopP1tcXFxcZEEtUFItVFpjZi1ucS11eT0+PH5dKSknLFxuXHRdLmpvaW4oJ3wnKTtcblxuXHRyZXR1cm4gbmV3IFJlZ0V4cChwYXR0ZXJuLCBvbmx5Rmlyc3QgPyB1bmRlZmluZWQgOiAnZycpO1xufVxuIiwiaW1wb3J0IGFuc2lSZWdleCBmcm9tICdhbnNpLXJlZ2V4JztcblxuY29uc3QgcmVnZXggPSBhbnNpUmVnZXgoKTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc3RyaXBBbnNpKHN0cmluZykge1xuXHRpZiAodHlwZW9mIHN0cmluZyAhPT0gJ3N0cmluZycpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGBFeHBlY3RlZCBhIFxcYHN0cmluZ1xcYCwgZ290IFxcYCR7dHlwZW9mIHN0cmluZ31cXGBgKTtcblx0fVxuXG5cdC8vIEV2ZW4gdGhvdWdoIHRoZSByZWdleCBpcyBnbG9iYWwsIHdlIGRvbid0IG5lZWQgdG8gcmVzZXQgdGhlIGAubGFzdEluZGV4YFxuXHQvLyBiZWNhdXNlIHVubGlrZSBgLmV4ZWMoKWAgYW5kIGAudGVzdCgpYCwgYC5yZXBsYWNlKClgIGRvZXMgaXQgYXV0b21hdGljYWxseVxuXHQvLyBhbmQgZG9pbmcgaXQgbWFudWFsbHkgaGFzIGEgcGVyZm9ybWFuY2UgcGVuYWx0eS5cblx0cmV0dXJuIHN0cmluZy5yZXBsYWNlKHJlZ2V4LCAnJyk7XG59XG4iLCJpbXBvcnQgcHJvY2VzcyBmcm9tICdub2RlOnByb2Nlc3MnO1xuaW1wb3J0IHt1c2VySW5mb30gZnJvbSAnbm9kZTpvcyc7XG5cbmV4cG9ydCBjb25zdCBkZXRlY3REZWZhdWx0U2hlbGwgPSAoKSA9PiB7XG5cdGNvbnN0IHtlbnZ9ID0gcHJvY2VzcztcblxuXHRpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuXHRcdHJldHVybiBlbnYuQ09NU1BFQyB8fCAnY21kLmV4ZSc7XG5cdH1cblxuXHR0cnkge1xuXHRcdGNvbnN0IHtzaGVsbH0gPSB1c2VySW5mbygpO1xuXHRcdGlmIChzaGVsbCkge1xuXHRcdFx0cmV0dXJuIHNoZWxsO1xuXHRcdH1cblx0fSBjYXRjaCB7fVxuXG5cdGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuXHRcdHJldHVybiBlbnYuU0hFTEwgfHwgJy9iaW4venNoJztcblx0fVxuXG5cdHJldHVybiBlbnYuU0hFTEwgfHwgJy9iaW4vc2gnO1xufTtcblxuLy8gU3RvcmVzIGRlZmF1bHQgc2hlbGwgd2hlbiBpbXBvcnRlZC5cbmNvbnN0IGRlZmF1bHRTaGVsbCA9IGRldGVjdERlZmF1bHRTaGVsbCgpO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZhdWx0U2hlbGw7XG4iLCJpbXBvcnQgcHJvY2VzcyBmcm9tICdub2RlOnByb2Nlc3MnO1xuaW1wb3J0IGV4ZWNhIGZyb20gJ2V4ZWNhJztcbmltcG9ydCBzdHJpcEFuc2kgZnJvbSAnc3RyaXAtYW5zaSc7XG5pbXBvcnQgZGVmYXVsdFNoZWxsIGZyb20gJ2RlZmF1bHQtc2hlbGwnO1xuXG5jb25zdCBhcmdzID0gW1xuXHQnLWlsYycsXG5cdCdlY2hvIC1uIFwiX1NIRUxMX0VOVl9ERUxJTUlURVJfXCI7IGVudjsgZWNobyAtbiBcIl9TSEVMTF9FTlZfREVMSU1JVEVSX1wiOyBleGl0Jyxcbl07XG5cbmNvbnN0IGVudiA9IHtcblx0Ly8gRGlzYWJsZXMgT2ggTXkgWnNoIGF1dG8tdXBkYXRlIHRoaW5nIHRoYXQgY2FuIGJsb2NrIHRoZSBwcm9jZXNzLlxuXHRESVNBQkxFX0FVVE9fVVBEQVRFOiAndHJ1ZScsXG59O1xuXG5jb25zdCBwYXJzZUVudiA9IGVudiA9PiB7XG5cdGVudiA9IGVudi5zcGxpdCgnX1NIRUxMX0VOVl9ERUxJTUlURVJfJylbMV07XG5cdGNvbnN0IHJldHVyblZhbHVlID0ge307XG5cblx0Zm9yIChjb25zdCBsaW5lIG9mIHN0cmlwQW5zaShlbnYpLnNwbGl0KCdcXG4nKS5maWx0ZXIobGluZSA9PiBCb29sZWFuKGxpbmUpKSkge1xuXHRcdGNvbnN0IFtrZXksIC4uLnZhbHVlc10gPSBsaW5lLnNwbGl0KCc9Jyk7XG5cdFx0cmV0dXJuVmFsdWVba2V5XSA9IHZhbHVlcy5qb2luKCc9Jyk7XG5cdH1cblxuXHRyZXR1cm4gcmV0dXJuVmFsdWU7XG59O1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2hlbGxFbnYoc2hlbGwpIHtcblx0aWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcblx0XHRyZXR1cm4gcHJvY2Vzcy5lbnY7XG5cdH1cblxuXHR0cnkge1xuXHRcdGNvbnN0IHtzdGRvdXR9ID0gYXdhaXQgZXhlY2Eoc2hlbGwgfHwgZGVmYXVsdFNoZWxsLCBhcmdzLCB7ZW52fSk7XG5cdFx0cmV0dXJuIHBhcnNlRW52KHN0ZG91dCk7XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0aWYgKHNoZWxsKSB7XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHByb2Nlc3MuZW52O1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hlbGxFbnZTeW5jKHNoZWxsKSB7XG5cdGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG5cdFx0cmV0dXJuIHByb2Nlc3MuZW52O1xuXHR9XG5cblx0dHJ5IHtcblx0XHRjb25zdCB7c3Rkb3V0fSA9IGV4ZWNhLnN5bmMoc2hlbGwgfHwgZGVmYXVsdFNoZWxsLCBhcmdzLCB7ZW52fSk7XG5cdFx0cmV0dXJuIHBhcnNlRW52KHN0ZG91dCk7XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0aWYgKHNoZWxsKSB7XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHByb2Nlc3MuZW52O1xuXHRcdH1cblx0fVxufVxuIiwiaW1wb3J0IHtzaGVsbEVudiwgc2hlbGxFbnZTeW5jfSBmcm9tICdzaGVsbC1lbnYnO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2hlbGxQYXRoKCkge1xuXHRjb25zdCB7UEFUSH0gPSBhd2FpdCBzaGVsbEVudigpO1xuXHRyZXR1cm4gUEFUSDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNoZWxsUGF0aFN5bmMoKSB7XG5cdGNvbnN0IHtQQVRIfSA9IHNoZWxsRW52U3luYygpO1xuXHRyZXR1cm4gUEFUSDtcbn1cbiIsImltcG9ydCBwcm9jZXNzIGZyb20gJ25vZGU6cHJvY2Vzcyc7XG5pbXBvcnQge3NoZWxsUGF0aFN5bmN9IGZyb20gJ3NoZWxsLXBhdGgnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBmaXhQYXRoKCkge1xuXHRpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHByb2Nlc3MuZW52LlBBVEggPSBzaGVsbFBhdGhTeW5jKCkgfHwgW1xuXHRcdCcuL25vZGVfbW9kdWxlcy8uYmluJyxcblx0XHQnLy5ub2RlYnJldy9jdXJyZW50L2JpbicsXG5cdFx0Jy91c3IvbG9jYWwvYmluJyxcblx0XHRwcm9jZXNzLmVudi5QQVRILFxuXHRdLmpvaW4oJzonKTtcbn1cbiIsImltcG9ydCB7IGV4dG5hbWUgfSBmcm9tIFwicGF0aC1icm93c2VyaWZ5XCI7XG5pbXBvcnQgeyBSZWFkYWJsZSB9IGZyb20gXCJzdHJlYW1cIjtcbmltcG9ydCB7IGNsaXBib2FyZCB9IGZyb20gXCJlbGVjdHJvblwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIElTdHJpbmdLZXlNYXA8VD4ge1xuICBba2V5OiBzdHJpbmddOiBUO1xufVxuXG5jb25zdCBJTUFHRV9FWFRfTElTVCA9IFtcbiAgXCIucG5nXCIsXG4gIFwiLmpwZ1wiLFxuICBcIi5qcGVnXCIsXG4gIFwiLmJtcFwiLFxuICBcIi5naWZcIixcbiAgXCIuc3ZnXCIsXG4gIFwiLnRpZmZcIixcbiAgXCIud2VicFwiLFxuICBcIi5hdmlmXCIsXG5dO1xuXG5jb25zdCBWSURFT19FWFRfTElTVCA9IFtcIi5tcDRcIiwgXCIubW92XCIsIFwiLndlYm1cIiwgXCIubWt2XCIsIFwiLmF2aVwiXTtcbmNvbnN0IEFVRElPX0VYVF9MSVNUID0gW1wiLm1wM1wiLCBcIi53YXZcIiwgXCIuZmxhY1wiLCBcIi5hYWNcIiwgXCIub2dnXCJdO1xuXG5leHBvcnQgY29uc3QgTUVESUFfRVhUX0xJU1QgPSBbXG4gIC4uLlZJREVPX0VYVF9MSVNULFxuICAuLi5BVURJT19FWFRfTElTVCxcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0FuSW1hZ2UoZXh0OiBzdHJpbmcpIHtcbiAgcmV0dXJuIElNQUdFX0VYVF9MSVNULmluY2x1ZGVzKGV4dC50b0xvd2VyQ2FzZSgpKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBpc0Fzc2V0VHlwZUFuSW1hZ2UocGF0aDogc3RyaW5nKTogQm9vbGVhbiB7XG4gIHJldHVybiBpc0FuSW1hZ2UoZXh0bmFtZShwYXRoKSk7XG59XG5leHBvcnQgZnVuY3Rpb24gaXNBc3NldFR5cGVBbkFzc2V0KHBhdGg6IHN0cmluZyk6IEJvb2xlYW4ge1xuICBjb25zdCBleHQgPSBleHRuYW1lKHBhdGgpLnRvTG93ZXJDYXNlKCk7XG4gIHJldHVybiBpc0FuSW1hZ2UoZXh0KSB8fCBNRURJQV9FWFRfTElTVC5pbmNsdWRlcyhleHQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNIdG1sRmlsZShuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgZXh0ID0gZXh0bmFtZShuYW1lKS50b0xvd2VyQ2FzZSgpO1xuICByZXR1cm4gZXh0ID09PSBcIi5odG1sXCIgfHwgZXh0ID09PSBcIi5odG1cIjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyYXBIdG1sUHJldmlld0NvZGUoc291cmNlOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBydW5zID0gc291cmNlLm1hdGNoKC9gKy9nKTtcbiAgY29uc3QgbG9uZ2VzdFJ1biA9IHJ1bnMgPyBNYXRoLm1heCguLi5ydW5zLm1hcChydW4gPT4gcnVuLmxlbmd0aCkpIDogMDtcbiAgY29uc3QgZmVuY2VMZW5ndGggPSBsb25nZXN0UnVuID49IDMgPyBsb25nZXN0UnVuICsgMSA6IDU7XG4gIGNvbnN0IGZlbmNlID0gXCJgXCIucmVwZWF0KGZlbmNlTGVuZ3RoKTtcbiAgcmV0dXJuIGAke2ZlbmNlfWh0bWwtcHJldmlld1xcbiR7c291cmNlfVxcbiR7ZmVuY2V9XFxuYDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdyYXBIdG1sUHJldmlld1BhdGgocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGBcXGBcXGBcXGBodG1sLXByZXZpZXdcXG5wYXRoOiR7cGF0aH1cXG5cXGBcXGBcXGBcXG5gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RW1iZWRNYXJrZG93bihcbiAgZmlsZU5hbWU6IHN0cmluZyxcbiAgdXJsOiBzdHJpbmcsXG4gIGltYWdlTmFtZSA9IGZpbGVOYW1lXG4pIHtcbiAgY29uc3QgZXh0ID0gZXh0bmFtZShmaWxlTmFtZSkudG9Mb3dlckNhc2UoKTtcblxuICBpZiAoVklERU9fRVhUX0xJU1QuaW5jbHVkZXMoZXh0KSkge1xuICAgIHJldHVybiBgPHZpZGVvIHNyYz1cIiR7dXJsfVwiIGNvbnRyb2xzIHdpZHRoPVwiMzAwXCI+PC92aWRlbz5gO1xuICB9XG5cbiAgaWYgKEFVRElPX0VYVF9MSVNULmluY2x1ZGVzKGV4dCkpIHtcbiAgICByZXR1cm4gYDxhdWRpbyBzcmM9XCIke3VybH1cIiBjb250cm9scz48L2F1ZGlvPmA7XG4gIH1cblxuICByZXR1cm4gYCFbJHtpbWFnZU5hbWV9XSgke3VybH0pYDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE9TKCkge1xuICBjb25zdCB7IGFwcFZlcnNpb24gfSA9IG5hdmlnYXRvcjtcbiAgaWYgKGFwcFZlcnNpb24uaW5kZXhPZihcIldpblwiKSAhPT0gLTEpIHtcbiAgICByZXR1cm4gXCJXaW5kb3dzXCI7XG4gIH0gZWxzZSBpZiAoYXBwVmVyc2lvbi5pbmRleE9mKFwiTWFjXCIpICE9PSAtMSkge1xuICAgIHJldHVybiBcIk1hY09TXCI7XG4gIH0gZWxzZSBpZiAoYXBwVmVyc2lvbi5pbmRleE9mKFwiWDExXCIpICE9PSAtMSkge1xuICAgIHJldHVybiBcIkxpbnV4XCI7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIFwiVW5rbm93biBPU1wiO1xuICB9XG59XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3RyZWFtVG9TdHJpbmcoc3RyZWFtOiBSZWFkYWJsZSkge1xuICBjb25zdCBjaHVua3MgPSBbXTtcblxuICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHN0cmVhbSkge1xuICAgIGNodW5rcy5wdXNoKEJ1ZmZlci5mcm9tKGNodW5rKSk7XG4gIH1cblxuICAvLyBAdHMtaWdub3JlXG4gIHJldHVybiBCdWZmZXIuY29uY2F0KGNodW5rcykudG9TdHJpbmcoXCJ1dGYtOFwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVybEFzc2V0KHVybDogc3RyaW5nKSB7XG4gIHJldHVybiAodXJsID0gdXJsLnN1YnN0cigxICsgdXJsLmxhc3RJbmRleE9mKFwiL1wiKSkuc3BsaXQoXCI/XCIpWzBdKS5zcGxpdChcbiAgICBcIiNcIlxuICApWzBdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNDb3B5SW1hZ2VGaWxlKCkge1xuICBsZXQgZmlsZVBhdGggPSBcIlwiO1xuICBjb25zdCBvcyA9IGdldE9TKCk7XG5cbiAgaWYgKG9zID09PSBcIldpbmRvd3NcIikge1xuICAgIHZhciByYXdGaWxlUGF0aCA9IGNsaXBib2FyZC5yZWFkKFwiRmlsZU5hbWVXXCIpO1xuICAgIGZpbGVQYXRoID0gcmF3RmlsZVBhdGgucmVwbGFjZShuZXcgUmVnRXhwKFN0cmluZy5mcm9tQ2hhckNvZGUoMCksIFwiZ1wiKSwgXCJcIik7XG4gIH0gZWxzZSBpZiAob3MgPT09IFwiTWFjT1NcIikge1xuICAgIGZpbGVQYXRoID0gY2xpcGJvYXJkLnJlYWQoXCJwdWJsaWMuZmlsZS11cmxcIikucmVwbGFjZShcImZpbGU6Ly9cIiwgXCJcIik7XG4gIH0gZWxzZSB7XG4gICAgZmlsZVBhdGggPSBcIlwiO1xuICB9XG4gIHJldHVybiBpc0Fzc2V0VHlwZUFuSW1hZ2UoZmlsZVBhdGgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TGFzdEltYWdlKGxpc3Q6IHN0cmluZ1tdKSB7XG4gIGNvbnN0IHJldmVyc2VkTGlzdCA9IGxpc3QucmV2ZXJzZSgpO1xuICBsZXQgbGFzdEltYWdlO1xuICByZXZlcnNlZExpc3QuZm9yRWFjaChpdGVtID0+IHtcbiAgICBpZiAoaXRlbSAmJiBpdGVtLnN0YXJ0c1dpdGgoXCJodHRwXCIpKSB7XG4gICAgICBsYXN0SW1hZ2UgPSBpdGVtO1xuICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGxhc3RJbWFnZTtcbn1cblxuaW50ZXJmYWNlIEFueU9iaiB7XG4gIFtrZXk6IHN0cmluZ106IGFueTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFycmF5VG9PYmplY3Q8VCBleHRlbmRzIEFueU9iaj4oXG4gIGFycjogVFtdLFxuICBrZXk6IHN0cmluZ1xuKTogeyBba2V5OiBzdHJpbmddOiBUIH0ge1xuICBjb25zdCBvYmo6IHsgW2tleTogc3RyaW5nXTogVCB9ID0ge307XG4gIGFyci5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuICAgIG9ialtlbGVtZW50W2tleV1dID0gZWxlbWVudDtcbiAgfSk7XG4gIHJldHVybiBvYmo7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWZmZXJUb0FycmF5QnVmZmVyKGJ1ZmZlcjogQnVmZmVyKSB7XG4gIGNvbnN0IGFycmF5QnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKGJ1ZmZlci5sZW5ndGgpO1xuICBjb25zdCB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXlCdWZmZXIpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGJ1ZmZlci5sZW5ndGg7IGkrKykge1xuICAgIHZpZXdbaV0gPSBidWZmZXJbaV07XG4gIH1cbiAgcmV0dXJuIGFycmF5QnVmZmVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXVpZCgpIHtcbiAgcmV0dXJuIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpO1xufVxuIiwiaW1wb3J0IHsgQXBwLCBNb2RhbCwgTm90aWNlLCBzZXRJY29uIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJIdG1sUHJldmlldyhcbiAgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcbiAgc291cmNlOiBzdHJpbmcsXG4gIGFwcDogQXBwXG4pOiB2b2lkIHtcbiAgY29udGFpbmVyLmFkZENsYXNzKFwiaHRtbC1wcmV2aWV3LWNvbnRhaW5lclwiKTtcblxuICBjb25zdCB0b29sYmFyID0gY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcImh0bWwtcHJldmlldy10b29sYmFyXCIgfSk7XG5cbiAgY29uc3QgY29kZUJ1dHRvbiA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgIGNsczogXCJodG1sLXByZXZpZXctdG9vbC1idXR0b25cIixcbiAgfSk7XG4gIHNldEljb24oY29kZUJ1dHRvbiwgXCJjb2RlXCIpO1xuICBjb2RlQnV0dG9uLnNldEF0dHJpYnV0ZShcImFyaWEtbGFiZWxcIiwgXCJWaWV3IHNvdXJjZVwiKTtcblxuICBjb25zdCBtYXhpbWl6ZUJ1dHRvbiA9IHRvb2xiYXIuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgIGNsczogXCJodG1sLXByZXZpZXctdG9vbC1idXR0b25cIixcbiAgfSk7XG4gIHNldEljb24obWF4aW1pemVCdXR0b24sIFwibWF4aW1pemVcIik7XG4gIG1heGltaXplQnV0dG9uLnNldEF0dHJpYnV0ZShcImFyaWEtbGFiZWxcIiwgXCJPcGVuIGZ1bGxzY3JlZW4gcHJldmlld1wiKTtcblxuICBjb25zdCBkZWxldGVCdXR0b24gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICBjbHM6IFwiaHRtbC1wcmV2aWV3LXRvb2wtYnV0dG9uXCIsXG4gIH0pO1xuICBzZXRJY29uKGRlbGV0ZUJ1dHRvbiwgXCJ0cmFzaC0yXCIpO1xuICBkZWxldGVCdXR0b24uc2V0QXR0cmlidXRlKFwiYXJpYS1sYWJlbFwiLCBcIkRlbGV0ZSBIVE1MIHByZXZpZXdcIik7XG5cbiAgY29uc3QgZnJhbWVXcmFwcGVyID0gY29udGFpbmVyLmNyZWF0ZUVsKFwiZGl2XCIsIHtcbiAgICBjbHM6IFwiaHRtbC1wcmV2aWV3LWZyYW1lLXdyYXBwZXJcIixcbiAgfSk7XG5cbiAgY29uc3QgaWZyYW1lID0gZnJhbWVXcmFwcGVyLmNyZWF0ZUVsKFwiaWZyYW1lXCIsIHtcbiAgICBjbHM6IFwiaHRtbC1wcmV2aWV3LWlmcmFtZVwiLFxuICB9KTtcbiAgaWZyYW1lLmhpZGUoKTtcblxuICBjb25zdCBlcnJvckVsID0gZnJhbWVXcmFwcGVyLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcImh0bWwtcHJldmlldy1lcnJvclwiIH0pO1xuICBlcnJvckVsLmhpZGUoKTtcblxuICBjb25zdCByZXNpemVIYW5kbGUgPSBjb250YWluZXIuY3JlYXRlRWwoXCJkaXZcIiwge1xuICAgIGNsczogXCJodG1sLXByZXZpZXctcmVzaXplLWhhbmRsZVwiLFxuICAgIGF0dHI6IHsgXCJhcmlhLWxhYmVsXCI6IFwiUmVzaXplIHByZXZpZXdcIiB9LFxuICB9KTtcblxuICBjb25zdCB0cmltbWVkU291cmNlID0gc291cmNlLnRyaW0oKTtcbiAgbGV0IGxvYWRIdG1sOiAoKSA9PiBQcm9taXNlPHN0cmluZz47XG5cbiAgaWYgKHRyaW1tZWRTb3VyY2Uuc3RhcnRzV2l0aChcInBhdGg6XCIpKSB7XG4gICAgY29uc3QgZmlsZVBhdGggPSB0cmltbWVkU291cmNlLnNsaWNlKDUpLnRyaW0oKTtcbiAgICBsb2FkSHRtbCA9IGFzeW5jICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBhcHAudmF1bHQuYWRhcHRlci5yZWFkKGZpbGVQYXRoKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSFRNTCDmlofku7bmnKrmib7liLDvvJoke2ZpbGVQYXRofWApO1xuICAgICAgfVxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgbG9hZEh0bWwgPSBhc3luYyAoKSA9PiB0cmltbWVkU291cmNlO1xuICB9XG5cbiAgbG9hZEh0bWwoKVxuICAgIC50aGVuKGh0bWwgPT4ge1xuICAgICAgaWZyYW1lLnNyY2RvYyA9IGh0bWw7XG4gICAgICBpZnJhbWUuc2V0QXR0cmlidXRlKFwic2FuZGJveFwiLCBcImFsbG93LXNhbWUtb3JpZ2luIGFsbG93LXNjcmlwdHNcIik7XG4gICAgICBpZnJhbWUuc2hvdygpO1xuXG4gICAgICBjb2RlQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgY3VycmVudEh0bWwgPSBhd2FpdCBsb2FkSHRtbCgpO1xuICAgICAgICAgIG9wZW5IdG1sU291cmNlTW9kYWwoYXBwLCBjdXJyZW50SHRtbCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICAgICAgICBuZXcgTm90aWNlKG1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgbWF4aW1pemVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jICgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBjdXJyZW50SHRtbCA9IGF3YWl0IGxvYWRIdG1sKCk7XG4gICAgICAgICAgb3Blbkh0bWxQcmV2aWV3TW9kYWwoYXBwLCBjdXJyZW50SHRtbCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICAgICAgICBuZXcgTm90aWNlKG1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgZGVsZXRlQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIHNob3dEZWxldGVDb25maXJtUG9wb3ZlcihkZWxldGVCdXR0b24sIGFzeW5jICgpID0+IHtcbiAgICAgICAgICBhd2FpdCBkZWxldGVIdG1sUHJldmlld0Jsb2NrKGFwcCwgc291cmNlKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KVxuICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgZXJyb3JFbC5zZXRUZXh0KG1lc3NhZ2UpO1xuICAgICAgZXJyb3JFbC5zaG93KCk7XG4gICAgfSk7XG5cbiAgc2V0dXBSZXNpemVIYW5kbGUocmVzaXplSGFuZGxlLCBjb250YWluZXIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2NhbkFuZFJlbmRlckh0bWxQcmV2aWV3cyhyb290OiBIVE1MRWxlbWVudCwgYXBwOiBBcHApOiB2b2lkIHtcbiAgY29uc3QgY29kZUJsb2NrcyA9IHJvb3QucXVlcnlTZWxlY3RvckFsbChcInByZSA+IGNvZGUubGFuZ3VhZ2UtaHRtbC1wcmV2aWV3XCIpO1xuICBjb2RlQmxvY2tzLmZvckVhY2goY29kZSA9PiB7XG4gICAgY29uc3QgcHJlID0gY29kZS5wYXJlbnRFbGVtZW50IGFzIEhUTUxQcmVFbGVtZW50O1xuICAgIGNvbnN0IHNvdXJjZSA9IGNvZGUudGV4dENvbnRlbnQgfHwgXCJcIjtcbiAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHJlbmRlckh0bWxQcmV2aWV3KGNvbnRhaW5lciwgc291cmNlLCBhcHApO1xuICAgIHByZS5yZXBsYWNlV2l0aChjb250YWluZXIpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gc2V0dXBSZXNpemVIYW5kbGUoaGFuZGxlOiBIVE1MRWxlbWVudCwgY29udGFpbmVyOiBIVE1MRWxlbWVudCkge1xuICBjb25zdCBNSU5fSEVJR0hUID0gMTUwO1xuXG4gIGZ1bmN0aW9uIHN0YXJ0UmVzaXplKGNsaWVudFk6IG51bWJlcikge1xuICAgIGNvbnN0IHJlY3QgPSBjb250YWluZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgY29uc3Qgc3RhcnRIZWlnaHQgPSByZWN0LmhlaWdodDtcbiAgICBsZXQgcmFmSWQ6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICAgIGxldCBwZW5kaW5nWTogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cbiAgICBjb25zdCBvdmVybGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBvdmVybGF5LmFkZENsYXNzKFwiaHRtbC1wcmV2aWV3LXJlc2l6ZS1vdmVybGF5XCIpO1xuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChvdmVybGF5KTtcblxuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gXCJucy1yZXNpemVcIjtcbiAgICBjb250YWluZXIuYWRkQ2xhc3MoXCJodG1sLXByZXZpZXctcmVzaXppbmdcIik7XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVIZWlnaHQobW92ZVk6IG51bWJlcikge1xuICAgICAgY29uc3QgZHkgPSBtb3ZlWSAtIGNsaWVudFk7XG4gICAgICBjb25zdCBuZXdIZWlnaHQgPSBNYXRoLm1heChNSU5fSEVJR0hULCBzdGFydEhlaWdodCArIGR5KTtcbiAgICAgIGNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHtuZXdIZWlnaHR9cHhgO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9uUG9pbnRlck1vdmUobW92ZUV2ZW50OiBQb2ludGVyRXZlbnQpIHtcbiAgICAgIHBlbmRpbmdZID0gbW92ZUV2ZW50LmNsaWVudFk7XG4gICAgICBpZiAocmFmSWQgPT09IG51bGwpIHtcbiAgICAgICAgcmFmSWQgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICAgICAgICBpZiAocGVuZGluZ1kgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHVwZGF0ZUhlaWdodChwZW5kaW5nWSk7XG4gICAgICAgICAgICBwZW5kaW5nWSA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJhZklkID0gbnVsbDtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb25Qb2ludGVyVXAoKSB7XG4gICAgICBpZiAocmFmSWQgIT09IG51bGwpIHtcbiAgICAgICAgd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKHJhZklkKTtcbiAgICAgICAgcmFmSWQgPSBudWxsO1xuICAgICAgfVxuICAgICAgaWYgKHBlbmRpbmdZICE9PSBudWxsKSB7XG4gICAgICAgIHVwZGF0ZUhlaWdodChwZW5kaW5nWSk7XG4gICAgICAgIHBlbmRpbmdZID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIG92ZXJsYXkucmVtb3ZlKCk7XG4gICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwicG9pbnRlcm1vdmVcIiwgb25Qb2ludGVyTW92ZSk7XG4gICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwicG9pbnRlcnVwXCIsIG9uUG9pbnRlclVwKTtcbiAgICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gXCJcIjtcbiAgICAgIGNvbnRhaW5lci5yZW1vdmVDbGFzcyhcImh0bWwtcHJldmlldy1yZXNpemluZ1wiKTtcbiAgICB9XG5cbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwicG9pbnRlcm1vdmVcIiwgb25Qb2ludGVyTW92ZSk7XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcInBvaW50ZXJ1cFwiLCBvblBvaW50ZXJVcCk7XG4gIH1cblxuICBoYW5kbGUuYWRkRXZlbnRMaXN0ZW5lcihcInBvaW50ZXJkb3duXCIsIGV2ZW50ID0+IHtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHN0YXJ0UmVzaXplKGV2ZW50LmNsaWVudFkpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gc2hvd0RlbGV0ZUNvbmZpcm1Qb3BvdmVyKFxuICBidXR0b246IEhUTUxFbGVtZW50LFxuICBvbkNvbmZpcm06ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+XG4pIHtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi5odG1sLXByZXZpZXctZGVsZXRlLXBvcG92ZXJcIik/LnJlbW92ZSgpO1xuXG4gIGNvbnN0IHBvcG92ZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICBwb3BvdmVyLmFkZENsYXNzKFwiaHRtbC1wcmV2aWV3LWRlbGV0ZS1wb3BvdmVyXCIpO1xuXG4gIHBvcG92ZXIuY3JlYXRlRWwoXCJkaXZcIiwge1xuICAgIGNsczogXCJodG1sLXByZXZpZXctZGVsZXRlLW1lc3NhZ2VcIixcbiAgICB0ZXh0OiBcIuWIoOmZpOatpCBIVE1MIOmihOiniO+8n1wiLFxuICB9KTtcblxuICBjb25zdCBidXR0b25zID0gcG9wb3Zlci5jcmVhdGVFbChcImRpdlwiLCB7XG4gICAgY2xzOiBcImh0bWwtcHJldmlldy1kZWxldGUtYnV0dG9uc1wiLFxuICB9KTtcblxuICBjb25zdCBjYW5jZWxCdXR0b24gPSBidXR0b25zLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICBjbHM6IFwiaHRtbC1wcmV2aWV3LWRlbGV0ZS1jYW5jZWxcIixcbiAgICB0ZXh0OiBcIuWPlua2iFwiLFxuICB9KTtcblxuICBjb25zdCBjb25maXJtQnV0dG9uID0gYnV0dG9ucy5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgY2xzOiBcImh0bWwtcHJldmlldy1kZWxldGUtY29uZmlybSBtb2Qtd2FybmluZ1wiLFxuICAgIHRleHQ6IFwi56Gu6K6k5Yig6ZmkXCIsXG4gIH0pO1xuXG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocG9wb3Zlcik7XG5cbiAgY29uc3QgcmVjdCA9IGJ1dHRvbi5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgcG9wb3Zlci5zdHlsZS5sZWZ0ID0gYCR7cmVjdC5sZWZ0fXB4YDtcbiAgcG9wb3Zlci5zdHlsZS50b3AgPSBgJHtyZWN0LmJvdHRvbSArIDR9cHhgO1xuXG4gIGNvbnN0IGNsb3NlUG9wb3ZlciA9ICgpID0+IHBvcG92ZXIucmVtb3ZlKCk7XG5cbiAgZnVuY3Rpb24gb3V0c2lkZUNsaWNrSGFuZGxlcihldmVudDogTW91c2VFdmVudCkge1xuICAgIGNvbnN0IHRhcmdldCA9IGV2ZW50LnRhcmdldCBhcyBOb2RlO1xuICAgIGlmICghcG9wb3Zlci5jb250YWlucyh0YXJnZXQpICYmICFidXR0b24uY29udGFpbnModGFyZ2V0KSkge1xuICAgICAgY2xvc2VQb3BvdmVyKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBvdXRzaWRlQ2xpY2tIYW5kbGVyLCB7IG9uY2U6IHRydWUgfSk7XG4gICAgfVxuICB9XG5cbiAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBvdXRzaWRlQ2xpY2tIYW5kbGVyLCB7IG9uY2U6IHRydWUgfSk7XG4gIH0sIDApO1xuXG4gIGNhbmNlbEJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgY2xvc2VQb3BvdmVyKTtcblxuICBjb25maXJtQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XG4gICAgY2xvc2VQb3BvdmVyKCk7XG4gICAgYXdhaXQgb25Db25maXJtKCk7XG4gIH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBkZWxldGVIdG1sUHJldmlld0Jsb2NrKGFwcDogQXBwLCBzb3VyY2U6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBhY3RpdmVGaWxlID0gYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gIGlmICghYWN0aXZlRmlsZSkge1xuICAgIG5ldyBOb3RpY2UoXCLmnKrmib7liLDlvZPliY3mlofku7ZcIik7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgYXBwLnZhdWx0LnJlYWQoYWN0aXZlRmlsZSk7XG4gICAgY29uc3QgdHJpbW1lZFNvdXJjZSA9IHNvdXJjZS50cmltKCk7XG5cbiAgICBjb25zdCBlc2NhcGVkU291cmNlID0gZXNjYXBlUmVnRXhwKHRyaW1tZWRTb3VyY2UpO1xuICAgIGNvbnN0IGNvZGVCbG9ja1JlZ2V4ID0gbmV3IFJlZ0V4cChcbiAgICAgIFwiYHszLH1cXFxccypodG1sLXByZXZpZXdcXFxccypcXFxcblwiICsgZXNjYXBlZFNvdXJjZSArIFwiXFxcXG5gezMsfVxcXFxzKlxcXFxuP1wiLFxuICAgICAgXCJnXCJcbiAgICApO1xuICAgIGNvbnN0IG5ld0NvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoY29kZUJsb2NrUmVnZXgsIFwiXCIpO1xuXG4gICAgaWYgKG5ld0NvbnRlbnQgPT09IGNvbnRlbnQpIHtcbiAgICAgIG5ldyBOb3RpY2UoXCLmnKrmib7liLDopoHliKDpmaTnmoQgSFRNTCDpooTop4jku6PnoIHlnZdcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IHNvdXJjZUZpbGVEZWxldGVkID0gZmFsc2U7XG5cbiAgICBpZiAodHJpbW1lZFNvdXJjZS5zdGFydHNXaXRoKFwicGF0aDpcIikpIHtcbiAgICAgIGNvbnN0IGZpbGVQYXRoID0gdHJpbW1lZFNvdXJjZS5zbGljZSg1KS50cmltKCk7XG4gICAgICBsZXQgcmVmZXJlbmNlQ291bnQgPSAwO1xuXG4gICAgICBmb3IgKGNvbnN0IG1kRmlsZSBvZiBhcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpKSB7XG4gICAgICAgIGNvbnN0IG1kQ29udGVudCA9IGF3YWl0IGFwcC52YXVsdC5yZWFkKG1kRmlsZSk7XG4gICAgICAgIGNvbnN0IG1hdGNoZXMgPSBtZENvbnRlbnQubWF0Y2goXG4gICAgICAgICAgbmV3IFJlZ0V4cChcInBhdGg6XCIgKyBlc2NhcGVSZWdFeHAoZmlsZVBhdGgpLCBcImdcIilcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgICByZWZlcmVuY2VDb3VudCArPSBtYXRjaGVzLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAocmVmZXJlbmNlQ291bnQgPD0gMSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IGFwcC52YXVsdC5hZGFwdGVyLnJlbW92ZShmaWxlUGF0aCk7XG4gICAgICAgICAgc291cmNlRmlsZURlbGV0ZWQgPSB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gcmVtb3ZlIEhUTUwgc291cmNlIGZpbGU6XCIsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGF3YWl0IGFwcC52YXVsdC5tb2RpZnkoYWN0aXZlRmlsZSwgbmV3Q29udGVudCk7XG5cbiAgICBpZiAoc291cmNlRmlsZURlbGV0ZWQpIHtcbiAgICAgIG5ldyBOb3RpY2UoXCLlt7LliKDpmaQgSFRNTCDpooTop4hcIik7XG4gICAgfSBlbHNlIGlmICh0cmltbWVkU291cmNlLnN0YXJ0c1dpdGgoXCJwYXRoOlwiKSkge1xuICAgICAgbmV3IE5vdGljZShcIuW3suWIoOmZpCBIVE1MIOmihOiniO+8iOa6kOaWh+S7tuS/neeVme+8jOS7jeacieWFtuS7luW8leeUqO+8iVwiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV3IE5vdGljZShcIuW3suWIoOmZpCBIVE1MIOmihOiniFwiKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkZhaWxlZCB0byBkZWxldGUgSFRNTCBwcmV2aWV3OlwiLCBlcnJvcik7XG4gICAgbmV3IE5vdGljZShcIuWIoOmZpCBIVE1MIOmihOiniOWksei0pVwiKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBlc2NhcGVSZWdFeHAodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB2YWx1ZS5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7XG59XG5cbmZ1bmN0aW9uIG9wZW5IdG1sU291cmNlTW9kYWwoYXBwOiBBcHAsIHNvdXJjZTogc3RyaW5nKSB7XG4gIGNsYXNzIEh0bWxTb3VyY2VNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgICBzb3VyY2U6IHN0cmluZztcblxuICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBzb3VyY2U6IHN0cmluZykge1xuICAgICAgc3VwZXIoYXBwKTtcbiAgICAgIHRoaXMuc291cmNlID0gc291cmNlO1xuICAgIH1cblxuICAgIG9uT3BlbigpIHtcbiAgICAgIHRoaXMubW9kYWxFbC5hZGRDbGFzcyhcImh0bWwtcHJldmlldy1tb2RhbFwiKTtcblxuICAgICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgICBjb250ZW50RWwuZW1wdHkoKTtcblxuICAgICAgY29uc3QgcHJlID0gY29udGVudEVsLmNyZWF0ZUVsKFwicHJlXCIsIHsgY2xzOiBcImh0bWwtcHJldmlldy1zb3VyY2VcIiB9KTtcbiAgICAgIGNvbnN0IGNvZGUgPSBwcmUuY3JlYXRlRWwoXCJjb2RlXCIpO1xuICAgICAgY29kZS5zZXRUZXh0KHRoaXMuc291cmNlKTtcbiAgICB9XG5cbiAgICBvbkNsb3NlKCkge1xuICAgICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICB9XG4gIH1cblxuICBuZXcgSHRtbFNvdXJjZU1vZGFsKGFwcCwgc291cmNlKS5vcGVuKCk7XG59XG5cbmZ1bmN0aW9uIG9wZW5IdG1sUHJldmlld01vZGFsKGFwcDogQXBwLCBzb3VyY2U6IHN0cmluZykge1xuICBjbGFzcyBIdG1sUHJldmlld01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICAgIHNvdXJjZTogc3RyaW5nO1xuXG4gICAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHNvdXJjZTogc3RyaW5nKSB7XG4gICAgICBzdXBlcihhcHApO1xuICAgICAgdGhpcy5zb3VyY2UgPSBzb3VyY2U7XG4gICAgfVxuXG4gICAgb25PcGVuKCkge1xuICAgICAgdGhpcy5tb2RhbEVsLmFkZENsYXNzKFwiaHRtbC1wcmV2aWV3LW1vZGFsXCIpO1xuXG4gICAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuXG4gICAgICBjb25zdCBpZnJhbWUgPSBjb250ZW50RWwuY3JlYXRlRWwoXCJpZnJhbWVcIiwge1xuICAgICAgICBjbHM6IFwiaHRtbC1wcmV2aWV3LW1vZGFsLWlmcmFtZVwiLFxuICAgICAgfSk7XG4gICAgICBpZnJhbWUuc3JjZG9jID0gdGhpcy5zb3VyY2U7XG4gICAgICBpZnJhbWUuc2V0QXR0cmlidXRlKFwic2FuZGJveFwiLCBcImFsbG93LXNhbWUtb3JpZ2luIGFsbG93LXNjcmlwdHNcIik7XG4gICAgfVxuXG4gICAgb25DbG9zZSgpIHtcbiAgICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgfVxuICB9XG5cbiAgbmV3IEh0bWxQcmV2aWV3TW9kYWwoYXBwLCBzb3VyY2UpLm9wZW4oKTtcbn1cbiIsImltcG9ydCB7IEFwcCB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHtcbiAgRGVjb3JhdGlvbixcbiAgRGVjb3JhdGlvblNldCxcbiAgV2lkZ2V0VHlwZSxcbiAgRWRpdG9yVmlldyxcbn0gZnJvbSBcIkBjb2RlbWlycm9yL3ZpZXdcIjtcbmltcG9ydCB7XG4gIFN0YXRlRmllbGQsXG4gIFRyYW5zYWN0aW9uLFxuICBFZGl0b3JTdGF0ZSxcbiAgUmFuZ2VTZXRCdWlsZGVyLFxuICBFeHRlbnNpb24sXG59IGZyb20gXCJAY29kZW1pcnJvci9zdGF0ZVwiO1xuaW1wb3J0IHsgc3ludGF4VHJlZSB9IGZyb20gXCJAY29kZW1pcnJvci9sYW5ndWFnZVwiO1xuaW1wb3J0IHsgcmVuZGVySHRtbFByZXZpZXcgfSBmcm9tIFwiLi9odG1sUHJldmlld1wiO1xuXG5jbGFzcyBIdG1sUHJldmlld1dpZGdldCBleHRlbmRzIFdpZGdldFR5cGUge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHNvdXJjZTogc3RyaW5nLFxuICAgIHByaXZhdGUgYXBwOiBBcHBcbiAgKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIHRvRE9NKHZpZXc6IEVkaXRvclZpZXcpOiBIVE1MRWxlbWVudCB7XG4gICAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICByZW5kZXJIdG1sUHJldmlldyhkaXYsIHRoaXMuc291cmNlLCB0aGlzLmFwcCk7XG4gICAgcmV0dXJuIGRpdjtcbiAgfVxuXG4gIGVxKG90aGVyOiBXaWRnZXRUeXBlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIChcbiAgICAgIG90aGVyIGluc3RhbmNlb2YgSHRtbFByZXZpZXdXaWRnZXQgJiZcbiAgICAgIG90aGVyLnNvdXJjZSA9PT0gdGhpcy5zb3VyY2UgJiZcbiAgICAgIG90aGVyLmFwcCA9PT0gdGhpcy5hcHBcbiAgICApO1xuICB9XG5cbiAgZ2V0IGVzdGltYXRlZEhlaWdodCgpOiBudW1iZXIge1xuICAgIHJldHVybiA1MDA7XG4gIH1cblxuICBpZ25vcmVFdmVudChldmVudDogRXZlbnQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGh0bWxQcmV2aWV3RXh0ZW5zaW9uKGFwcDogQXBwKTogRXh0ZW5zaW9uIHtcbiAgcmV0dXJuIFN0YXRlRmllbGQuZGVmaW5lPERlY29yYXRpb25TZXQ+KHtcbiAgICBjcmVhdGUoc3RhdGU6IEVkaXRvclN0YXRlKSB7XG4gICAgICByZXR1cm4gYnVpbGREZWNvcmF0aW9ucyhzdGF0ZSwgYXBwKTtcbiAgICB9LFxuICAgIHVwZGF0ZSh2YWx1ZTogRGVjb3JhdGlvblNldCwgdHI6IFRyYW5zYWN0aW9uKSB7XG4gICAgICBpZiAodHIuZG9jQ2hhbmdlZCkge1xuICAgICAgICByZXR1cm4gYnVpbGREZWNvcmF0aW9ucyh0ci5zdGF0ZSwgYXBwKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9LFxuICAgIHByb3ZpZGU6IGYgPT4gRWRpdG9yVmlldy5kZWNvcmF0aW9ucy5mcm9tKGYpLFxuICB9KTtcbn1cblxuZnVuY3Rpb24gYnVpbGREZWNvcmF0aW9ucyhzdGF0ZTogRWRpdG9yU3RhdGUsIGFwcDogQXBwKTogRGVjb3JhdGlvblNldCB7XG4gIGNvbnN0IGJ1aWxkZXIgPSBuZXcgUmFuZ2VTZXRCdWlsZGVyPERlY29yYXRpb24+KCk7XG4gIGNvbnN0IHRyZWUgPSBzeW50YXhUcmVlKHN0YXRlKTtcblxuICB0cmVlLml0ZXJhdGUoe1xuICAgIGVudGVyOiBub2RlID0+IHtcbiAgICAgIGlmIChub2RlLnR5cGUubmFtZSAhPT0gXCJGZW5jZWRDb2RlXCIpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsZXQgbGFuZ3VhZ2UgPSBcIlwiO1xuICAgICAgbGV0IHNvdXJjZSA9IFwiXCI7XG4gICAgICBjb25zdCBjdXJzb3IgPSBub2RlLm5vZGUuY3Vyc29yKCk7XG5cbiAgICAgIGlmIChjdXJzb3IuZmlyc3RDaGlsZCgpKSB7XG4gICAgICAgIGRvIHtcbiAgICAgICAgICBpZiAoY3Vyc29yLnR5cGUubmFtZSA9PT0gXCJDb2RlSW5mb1wiKSB7XG4gICAgICAgICAgICBsYW5ndWFnZSA9IHN0YXRlLmRvYy5zbGljZVN0cmluZyhjdXJzb3IuZnJvbSwgY3Vyc29yLnRvKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGN1cnNvci50eXBlLm5hbWUgPT09IFwiQ29kZVRleHRcIikge1xuICAgICAgICAgICAgc291cmNlID0gc3RhdGUuZG9jLnNsaWNlU3RyaW5nKGN1cnNvci5mcm9tLCBjdXJzb3IudG8pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSB3aGlsZSAoY3Vyc29yLm5leHRTaWJsaW5nKCkpO1xuICAgICAgfVxuXG4gICAgICBpZiAobGFuZ3VhZ2UgPT09IFwiaHRtbC1wcmV2aWV3XCIpIHtcbiAgICAgICAgYnVpbGRlci5hZGQoXG4gICAgICAgICAgbm9kZS5mcm9tLFxuICAgICAgICAgIG5vZGUudG8sXG4gICAgICAgICAgRGVjb3JhdGlvbi5yZXBsYWNlKHtcbiAgICAgICAgICAgIHdpZGdldDogbmV3IEh0bWxQcmV2aWV3V2lkZ2V0KHNvdXJjZSwgYXBwKSxcbiAgICAgICAgICAgIGJsb2NrOiB0cnVlLFxuICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIGJ1aWxkZXIuZmluaXNoKCk7XG59XG4iLCJpbXBvcnQgKiBhcyBpZWVlNzU0IGZyb20gJ2llZWU3NTQnO1xuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSAnbm9kZTpidWZmZXInO1xuLy8gUHJpbWl0aXZlIHR5cGVzXG5mdW5jdGlvbiBkdihhcnJheSkge1xuICAgIHJldHVybiBuZXcgRGF0YVZpZXcoYXJyYXkuYnVmZmVyLCBhcnJheS5ieXRlT2Zmc2V0KTtcbn1cbi8qKlxuICogOC1iaXQgdW5zaWduZWQgaW50ZWdlclxuICovXG5leHBvcnQgY29uc3QgVUlOVDggPSB7XG4gICAgbGVuOiAxLFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0VWludDgob2Zmc2V0KTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0VWludDgob2Zmc2V0LCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyAxO1xuICAgIH1cbn07XG4vKipcbiAqIDE2LWJpdCB1bnNpZ25lZCBpbnRlZ2VyLCBMaXR0bGUgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IFVJTlQxNl9MRSA9IHtcbiAgICBsZW46IDIsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRVaW50MTYob2Zmc2V0LCB0cnVlKTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0VWludDE2KG9mZnNldCwgdmFsdWUsIHRydWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgMjtcbiAgICB9XG59O1xuLyoqXG4gKiAxNi1iaXQgdW5zaWduZWQgaW50ZWdlciwgQmlnIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBVSU5UMTZfQkUgPSB7XG4gICAgbGVuOiAyLFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0VWludDE2KG9mZnNldCk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldFVpbnQxNihvZmZzZXQsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDI7XG4gICAgfVxufTtcbi8qKlxuICogMjQtYml0IHVuc2lnbmVkIGludGVnZXIsIExpdHRsZSBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgVUlOVDI0X0xFID0ge1xuICAgIGxlbjogMyxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICBjb25zdCBkYXRhVmlldyA9IGR2KGFycmF5KTtcbiAgICAgICAgcmV0dXJuIGRhdGFWaWV3LmdldFVpbnQ4KG9mZnNldCkgKyAoZGF0YVZpZXcuZ2V0VWludDE2KG9mZnNldCArIDEsIHRydWUpIDw8IDgpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGRhdGFWaWV3ID0gZHYoYXJyYXkpO1xuICAgICAgICBkYXRhVmlldy5zZXRVaW50OChvZmZzZXQsIHZhbHVlICYgMHhmZik7XG4gICAgICAgIGRhdGFWaWV3LnNldFVpbnQxNihvZmZzZXQgKyAxLCB2YWx1ZSA+PiA4LCB0cnVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDM7XG4gICAgfVxufTtcbi8qKlxuICogMjQtYml0IHVuc2lnbmVkIGludGVnZXIsIEJpZyBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgVUlOVDI0X0JFID0ge1xuICAgIGxlbjogMyxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICBjb25zdCBkYXRhVmlldyA9IGR2KGFycmF5KTtcbiAgICAgICAgcmV0dXJuIChkYXRhVmlldy5nZXRVaW50MTYob2Zmc2V0KSA8PCA4KSArIGRhdGFWaWV3LmdldFVpbnQ4KG9mZnNldCArIDIpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGRhdGFWaWV3ID0gZHYoYXJyYXkpO1xuICAgICAgICBkYXRhVmlldy5zZXRVaW50MTYob2Zmc2V0LCB2YWx1ZSA+PiA4KTtcbiAgICAgICAgZGF0YVZpZXcuc2V0VWludDgob2Zmc2V0ICsgMiwgdmFsdWUgJiAweGZmKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDM7XG4gICAgfVxufTtcbi8qKlxuICogMzItYml0IHVuc2lnbmVkIGludGVnZXIsIExpdHRsZSBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgVUlOVDMyX0xFID0ge1xuICAgIGxlbjogNCxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldFVpbnQzMihvZmZzZXQsIHRydWUpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRVaW50MzIob2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyA0O1xuICAgIH1cbn07XG4vKipcbiAqIDMyLWJpdCB1bnNpZ25lZCBpbnRlZ2VyLCBCaWcgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IFVJTlQzMl9CRSA9IHtcbiAgICBsZW46IDQsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRVaW50MzIob2Zmc2V0KTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0VWludDMyKG9mZnNldCwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgNDtcbiAgICB9XG59O1xuLyoqXG4gKiA4LWJpdCBzaWduZWQgaW50ZWdlclxuICovXG5leHBvcnQgY29uc3QgSU5UOCA9IHtcbiAgICBsZW46IDEsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRJbnQ4KG9mZnNldCk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldEludDgob2Zmc2V0LCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyAxO1xuICAgIH1cbn07XG4vKipcbiAqIDE2LWJpdCBzaWduZWQgaW50ZWdlciwgQmlnIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBJTlQxNl9CRSA9IHtcbiAgICBsZW46IDIsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRJbnQxNihvZmZzZXQpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRJbnQxNihvZmZzZXQsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDI7XG4gICAgfVxufTtcbi8qKlxuICogMTYtYml0IHNpZ25lZCBpbnRlZ2VyLCBMaXR0bGUgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IElOVDE2X0xFID0ge1xuICAgIGxlbjogMixcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldEludDE2KG9mZnNldCwgdHJ1ZSk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldEludDE2KG9mZnNldCwgdmFsdWUsIHRydWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgMjtcbiAgICB9XG59O1xuLyoqXG4gKiAyNC1iaXQgc2lnbmVkIGludGVnZXIsIExpdHRsZSBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgSU5UMjRfTEUgPSB7XG4gICAgbGVuOiAzLFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IHVuc2lnbmVkID0gVUlOVDI0X0xFLmdldChhcnJheSwgb2Zmc2V0KTtcbiAgICAgICAgcmV0dXJuIHVuc2lnbmVkID4gMHg3ZmZmZmYgPyB1bnNpZ25lZCAtIDB4MTAwMDAwMCA6IHVuc2lnbmVkO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGRhdGFWaWV3ID0gZHYoYXJyYXkpO1xuICAgICAgICBkYXRhVmlldy5zZXRVaW50OChvZmZzZXQsIHZhbHVlICYgMHhmZik7XG4gICAgICAgIGRhdGFWaWV3LnNldFVpbnQxNihvZmZzZXQgKyAxLCB2YWx1ZSA+PiA4LCB0cnVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDM7XG4gICAgfVxufTtcbi8qKlxuICogMjQtYml0IHNpZ25lZCBpbnRlZ2VyLCBCaWcgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IElOVDI0X0JFID0ge1xuICAgIGxlbjogMyxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICBjb25zdCB1bnNpZ25lZCA9IFVJTlQyNF9CRS5nZXQoYXJyYXksIG9mZnNldCk7XG4gICAgICAgIHJldHVybiB1bnNpZ25lZCA+IDB4N2ZmZmZmID8gdW5zaWduZWQgLSAweDEwMDAwMDAgOiB1bnNpZ25lZDtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBjb25zdCBkYXRhVmlldyA9IGR2KGFycmF5KTtcbiAgICAgICAgZGF0YVZpZXcuc2V0VWludDE2KG9mZnNldCwgdmFsdWUgPj4gOCk7XG4gICAgICAgIGRhdGFWaWV3LnNldFVpbnQ4KG9mZnNldCArIDIsIHZhbHVlICYgMHhmZik7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyAzO1xuICAgIH1cbn07XG4vKipcbiAqIDMyLWJpdCBzaWduZWQgaW50ZWdlciwgQmlnIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBJTlQzMl9CRSA9IHtcbiAgICBsZW46IDQsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRJbnQzMihvZmZzZXQpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRJbnQzMihvZmZzZXQsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDQ7XG4gICAgfVxufTtcbi8qKlxuICogMzItYml0IHNpZ25lZCBpbnRlZ2VyLCBCaWcgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IElOVDMyX0xFID0ge1xuICAgIGxlbjogNCxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldEludDMyKG9mZnNldCwgdHJ1ZSk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldEludDMyKG9mZnNldCwgdmFsdWUsIHRydWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgNDtcbiAgICB9XG59O1xuLyoqXG4gKiA2NC1iaXQgdW5zaWduZWQgaW50ZWdlciwgTGl0dGxlIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBVSU5UNjRfTEUgPSB7XG4gICAgbGVuOiA4LFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0QmlnVWludDY0KG9mZnNldCwgdHJ1ZSk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldEJpZ1VpbnQ2NChvZmZzZXQsIHZhbHVlLCB0cnVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDg7XG4gICAgfVxufTtcbi8qKlxuICogNjQtYml0IHNpZ25lZCBpbnRlZ2VyLCBMaXR0bGUgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IElOVDY0X0xFID0ge1xuICAgIGxlbjogOCxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldEJpZ0ludDY0KG9mZnNldCwgdHJ1ZSk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldEJpZ0ludDY0KG9mZnNldCwgdmFsdWUsIHRydWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgODtcbiAgICB9XG59O1xuLyoqXG4gKiA2NC1iaXQgdW5zaWduZWQgaW50ZWdlciwgQmlnIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBVSU5UNjRfQkUgPSB7XG4gICAgbGVuOiA4LFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0QmlnVWludDY0KG9mZnNldCk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldEJpZ1VpbnQ2NChvZmZzZXQsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDg7XG4gICAgfVxufTtcbi8qKlxuICogNjQtYml0IHNpZ25lZCBpbnRlZ2VyLCBCaWcgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IElOVDY0X0JFID0ge1xuICAgIGxlbjogOCxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldEJpZ0ludDY0KG9mZnNldCk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldEJpZ0ludDY0KG9mZnNldCwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgODtcbiAgICB9XG59O1xuLyoqXG4gKiBJRUVFIDc1NCAxNi1iaXQgKGhhbGYgcHJlY2lzaW9uKSBmbG9hdCwgYmlnIGVuZGlhblxuICovXG5leHBvcnQgY29uc3QgRmxvYXQxNl9CRSA9IHtcbiAgICBsZW46IDIsXG4gICAgZ2V0KGRhdGFWaWV3LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGllZWU3NTQucmVhZChkYXRhVmlldywgb2Zmc2V0LCBmYWxzZSwgMTAsIHRoaXMubGVuKTtcbiAgICB9LFxuICAgIHB1dChkYXRhVmlldywgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBpZWVlNzU0LndyaXRlKGRhdGFWaWV3LCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgMTAsIHRoaXMubGVuKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIHRoaXMubGVuO1xuICAgIH1cbn07XG4vKipcbiAqIElFRUUgNzU0IDE2LWJpdCAoaGFsZiBwcmVjaXNpb24pIGZsb2F0LCBsaXR0bGUgZW5kaWFuXG4gKi9cbmV4cG9ydCBjb25zdCBGbG9hdDE2X0xFID0ge1xuICAgIGxlbjogMixcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gaWVlZTc1NC5yZWFkKGFycmF5LCBvZmZzZXQsIHRydWUsIDEwLCB0aGlzLmxlbik7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgaWVlZTc1NC53cml0ZShhcnJheSwgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgMTAsIHRoaXMubGVuKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIHRoaXMubGVuO1xuICAgIH1cbn07XG4vKipcbiAqIElFRUUgNzU0IDMyLWJpdCAoc2luZ2xlIHByZWNpc2lvbikgZmxvYXQsIGJpZyBlbmRpYW5cbiAqL1xuZXhwb3J0IGNvbnN0IEZsb2F0MzJfQkUgPSB7XG4gICAgbGVuOiA0LFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0RmxvYXQzMihvZmZzZXQpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRGbG9hdDMyKG9mZnNldCwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgNDtcbiAgICB9XG59O1xuLyoqXG4gKiBJRUVFIDc1NCAzMi1iaXQgKHNpbmdsZSBwcmVjaXNpb24pIGZsb2F0LCBsaXR0bGUgZW5kaWFuXG4gKi9cbmV4cG9ydCBjb25zdCBGbG9hdDMyX0xFID0ge1xuICAgIGxlbjogNCxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldEZsb2F0MzIob2Zmc2V0LCB0cnVlKTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0RmxvYXQzMihvZmZzZXQsIHZhbHVlLCB0cnVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDQ7XG4gICAgfVxufTtcbi8qKlxuICogSUVFRSA3NTQgNjQtYml0IChkb3VibGUgcHJlY2lzaW9uKSBmbG9hdCwgYmlnIGVuZGlhblxuICovXG5leHBvcnQgY29uc3QgRmxvYXQ2NF9CRSA9IHtcbiAgICBsZW46IDgsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRGbG9hdDY0KG9mZnNldCk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldEZsb2F0NjQob2Zmc2V0LCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyA4O1xuICAgIH1cbn07XG4vKipcbiAqIElFRUUgNzU0IDY0LWJpdCAoZG91YmxlIHByZWNpc2lvbikgZmxvYXQsIGxpdHRsZSBlbmRpYW5cbiAqL1xuZXhwb3J0IGNvbnN0IEZsb2F0NjRfTEUgPSB7XG4gICAgbGVuOiA4LFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0RmxvYXQ2NChvZmZzZXQsIHRydWUpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRGbG9hdDY0KG9mZnNldCwgdmFsdWUsIHRydWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgODtcbiAgICB9XG59O1xuLyoqXG4gKiBJRUVFIDc1NCA4MC1iaXQgKGV4dGVuZGVkIHByZWNpc2lvbikgZmxvYXQsIGJpZyBlbmRpYW5cbiAqL1xuZXhwb3J0IGNvbnN0IEZsb2F0ODBfQkUgPSB7XG4gICAgbGVuOiAxMCxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gaWVlZTc1NC5yZWFkKGFycmF5LCBvZmZzZXQsIGZhbHNlLCA2MywgdGhpcy5sZW4pO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGllZWU3NTQud3JpdGUoYXJyYXksIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCA2MywgdGhpcy5sZW4pO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgdGhpcy5sZW47XG4gICAgfVxufTtcbi8qKlxuICogSUVFRSA3NTQgODAtYml0IChleHRlbmRlZCBwcmVjaXNpb24pIGZsb2F0LCBsaXR0bGUgZW5kaWFuXG4gKi9cbmV4cG9ydCBjb25zdCBGbG9hdDgwX0xFID0ge1xuICAgIGxlbjogMTAsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGllZWU3NTQucmVhZChhcnJheSwgb2Zmc2V0LCB0cnVlLCA2MywgdGhpcy5sZW4pO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGllZWU3NTQud3JpdGUoYXJyYXksIHZhbHVlLCBvZmZzZXQsIHRydWUsIDYzLCB0aGlzLmxlbik7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyB0aGlzLmxlbjtcbiAgICB9XG59O1xuLyoqXG4gKiBJZ25vcmUgYSBnaXZlbiBudW1iZXIgb2YgYnl0ZXNcbiAqL1xuZXhwb3J0IGNsYXNzIElnbm9yZVR5cGUge1xuICAgIC8qKlxuICAgICAqIEBwYXJhbSBsZW4gbnVtYmVyIG9mIGJ5dGVzIHRvIGlnbm9yZVxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGxlbikge1xuICAgICAgICB0aGlzLmxlbiA9IGxlbjtcbiAgICB9XG4gICAgLy8gVG9EbzogZG9uJ3QgcmVhZCwgYnV0IHNraXAgZGF0YVxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZW1wdHktZnVuY3Rpb25cbiAgICBnZXQoYXJyYXksIG9mZikge1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBVaW50OEFycmF5VHlwZSB7XG4gICAgY29uc3RydWN0b3IobGVuKSB7XG4gICAgICAgIHRoaXMubGVuID0gbGVuO1xuICAgIH1cbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gYXJyYXkuc3ViYXJyYXkob2Zmc2V0LCBvZmZzZXQgKyB0aGlzLmxlbik7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEJ1ZmZlclR5cGUge1xuICAgIGNvbnN0cnVjdG9yKGxlbikge1xuICAgICAgICB0aGlzLmxlbiA9IGxlbjtcbiAgICB9XG4gICAgZ2V0KHVpbnQ4QXJyYXksIG9mZikge1xuICAgICAgICByZXR1cm4gQnVmZmVyLmZyb20odWludDhBcnJheS5zdWJhcnJheShvZmYsIG9mZiArIHRoaXMubGVuKSk7XG4gICAgfVxufVxuLyoqXG4gKiBDb25zdW1lIGEgZml4ZWQgbnVtYmVyIG9mIGJ5dGVzIGZyb20gdGhlIHN0cmVhbSBhbmQgcmV0dXJuIGEgc3RyaW5nIHdpdGggYSBzcGVjaWZpZWQgZW5jb2RpbmcuXG4gKi9cbmV4cG9ydCBjbGFzcyBTdHJpbmdUeXBlIHtcbiAgICBjb25zdHJ1Y3RvcihsZW4sIGVuY29kaW5nKSB7XG4gICAgICAgIHRoaXMubGVuID0gbGVuO1xuICAgICAgICB0aGlzLmVuY29kaW5nID0gZW5jb2Rpbmc7XG4gICAgfVxuICAgIGdldCh1aW50OEFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKHVpbnQ4QXJyYXkpLnRvU3RyaW5nKHRoaXMuZW5jb2RpbmcsIG9mZnNldCwgb2Zmc2V0ICsgdGhpcy5sZW4pO1xuICAgIH1cbn1cbi8qKlxuICogQU5TSSBMYXRpbiAxIFN0cmluZ1xuICogVXNpbmcgd2luZG93cy0xMjUyIC8gSVNPIDg4NTktMSBkZWNvZGluZ1xuICovXG5leHBvcnQgY2xhc3MgQW5zaVN0cmluZ1R5cGUge1xuICAgIGNvbnN0cnVjdG9yKGxlbikge1xuICAgICAgICB0aGlzLmxlbiA9IGxlbjtcbiAgICB9XG4gICAgc3RhdGljIGRlY29kZShidWZmZXIsIG9mZnNldCwgdW50aWwpIHtcbiAgICAgICAgbGV0IHN0ciA9ICcnO1xuICAgICAgICBmb3IgKGxldCBpID0gb2Zmc2V0OyBpIDwgdW50aWw7ICsraSkge1xuICAgICAgICAgICAgc3RyICs9IEFuc2lTdHJpbmdUeXBlLmNvZGVQb2ludFRvU3RyaW5nKEFuc2lTdHJpbmdUeXBlLnNpbmdsZUJ5dGVEZWNvZGVyKGJ1ZmZlcltpXSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICAgIHN0YXRpYyBpblJhbmdlKGEsIG1pbiwgbWF4KSB7XG4gICAgICAgIHJldHVybiBtaW4gPD0gYSAmJiBhIDw9IG1heDtcbiAgICB9XG4gICAgc3RhdGljIGNvZGVQb2ludFRvU3RyaW5nKGNwKSB7XG4gICAgICAgIGlmIChjcCA8PSAweEZGRkYpIHtcbiAgICAgICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKGNwKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNwIC09IDB4MTAwMDA7XG4gICAgICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZSgoY3AgPj4gMTApICsgMHhEODAwLCAoY3AgJiAweDNGRikgKyAweERDMDApO1xuICAgICAgICB9XG4gICAgfVxuICAgIHN0YXRpYyBzaW5nbGVCeXRlRGVjb2RlcihiaXRlKSB7XG4gICAgICAgIGlmIChBbnNpU3RyaW5nVHlwZS5pblJhbmdlKGJpdGUsIDB4MDAsIDB4N0YpKSB7XG4gICAgICAgICAgICByZXR1cm4gYml0ZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjb2RlUG9pbnQgPSBBbnNpU3RyaW5nVHlwZS53aW5kb3dzMTI1MltiaXRlIC0gMHg4MF07XG4gICAgICAgIGlmIChjb2RlUG9pbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKCdpbnZhbGlkaW5nIGVuY29kaW5nJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvZGVQb2ludDtcbiAgICB9XG4gICAgZ2V0KGJ1ZmZlciwgb2Zmc2V0ID0gMCkge1xuICAgICAgICByZXR1cm4gQW5zaVN0cmluZ1R5cGUuZGVjb2RlKGJ1ZmZlciwgb2Zmc2V0LCBvZmZzZXQgKyB0aGlzLmxlbik7XG4gICAgfVxufVxuQW5zaVN0cmluZ1R5cGUud2luZG93czEyNTIgPSBbODM2NCwgMTI5LCA4MjE4LCA0MDIsIDgyMjIsIDgyMzAsIDgyMjQsIDgyMjUsIDcxMCwgODI0MCwgMzUyLFxuICAgIDgyNDksIDMzOCwgMTQxLCAzODEsIDE0MywgMTQ0LCA4MjE2LCA4MjE3LCA4MjIwLCA4MjIxLCA4MjI2LCA4MjExLCA4MjEyLCA3MzIsXG4gICAgODQ4MiwgMzUzLCA4MjUwLCAzMzksIDE1NywgMzgyLCAzNzYsIDE2MCwgMTYxLCAxNjIsIDE2MywgMTY0LCAxNjUsIDE2NiwgMTY3LCAxNjgsXG4gICAgMTY5LCAxNzAsIDE3MSwgMTcyLCAxNzMsIDE3NCwgMTc1LCAxNzYsIDE3NywgMTc4LCAxNzksIDE4MCwgMTgxLCAxODIsIDE4MywgMTg0LFxuICAgIDE4NSwgMTg2LCAxODcsIDE4OCwgMTg5LCAxOTAsIDE5MSwgMTkyLCAxOTMsIDE5NCwgMTk1LCAxOTYsIDE5NywgMTk4LCAxOTksIDIwMCxcbiAgICAyMDEsIDIwMiwgMjAzLCAyMDQsIDIwNSwgMjA2LCAyMDcsIDIwOCwgMjA5LCAyMTAsIDIxMSwgMjEyLCAyMTMsIDIxNCwgMjE1LCAyMTYsXG4gICAgMjE3LCAyMTgsIDIxOSwgMjIwLCAyMjEsIDIyMiwgMjIzLCAyMjQsIDIyNSwgMjI2LCAyMjcsIDIyOCwgMjI5LCAyMzAsIDIzMSwgMjMyLFxuICAgIDIzMywgMjM0LCAyMzUsIDIzNiwgMjM3LCAyMzgsIDIzOSwgMjQwLCAyNDEsIDI0MiwgMjQzLCAyNDQsIDI0NSwgMjQ2LCAyNDcsXG4gICAgMjQ4LCAyNDksIDI1MCwgMjUxLCAyNTIsIDI1MywgMjU0LCAyNTVdO1xuIiwiZXhwb3J0IGNvbnN0IGRlZmF1bHRNZXNzYWdlcyA9ICdFbmQtT2YtU3RyZWFtJztcbi8qKlxuICogVGhyb3duIG9uIHJlYWQgb3BlcmF0aW9uIG9mIHRoZSBlbmQgb2YgZmlsZSBvciBzdHJlYW0gaGFzIGJlZW4gcmVhY2hlZFxuICovXG5leHBvcnQgY2xhc3MgRW5kT2ZTdHJlYW1FcnJvciBleHRlbmRzIEVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoZGVmYXVsdE1lc3NhZ2VzKTtcbiAgICB9XG59XG4iLCJleHBvcnQgY2xhc3MgRGVmZXJyZWQge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLnJlc29sdmUgPSAoKSA9PiBudWxsO1xuICAgICAgICB0aGlzLnJlamVjdCA9ICgpID0+IG51bGw7XG4gICAgICAgIHRoaXMucHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVqZWN0ID0gcmVqZWN0O1xuICAgICAgICAgICAgdGhpcy5yZXNvbHZlID0gcmVzb2x2ZTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgRW5kT2ZTdHJlYW1FcnJvciB9IGZyb20gXCIuL0VuZE9mU3RyZWFtRXJyb3IuanNcIjtcbmV4cG9ydCBjbGFzcyBBYnN0cmFjdFN0cmVhbVJlYWRlciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNYXhpbXVtIHJlcXVlc3QgbGVuZ3RoIG9uIHJlYWQtc3RyZWFtIG9wZXJhdGlvblxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5tYXhTdHJlYW1SZWFkU2l6ZSA9IDEgKiAxMDI0ICogMTAyNDtcbiAgICAgICAgdGhpcy5lbmRPZlN0cmVhbSA9IGZhbHNlO1xuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmUgcGVla2VkIGRhdGFcbiAgICAgICAgICogQHR5cGUge0FycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5wZWVrUXVldWUgPSBbXTtcbiAgICB9XG4gICAgYXN5bmMgcGVlayh1aW50OEFycmF5LCBvZmZzZXQsIGxlbmd0aCkge1xuICAgICAgICBjb25zdCBieXRlc1JlYWQgPSBhd2FpdCB0aGlzLnJlYWQodWludDhBcnJheSwgb2Zmc2V0LCBsZW5ndGgpO1xuICAgICAgICB0aGlzLnBlZWtRdWV1ZS5wdXNoKHVpbnQ4QXJyYXkuc3ViYXJyYXkob2Zmc2V0LCBvZmZzZXQgKyBieXRlc1JlYWQpKTsgLy8gUHV0IHJlYWQgZGF0YSBiYWNrIHRvIHBlZWsgYnVmZmVyXG4gICAgICAgIHJldHVybiBieXRlc1JlYWQ7XG4gICAgfVxuICAgIGFzeW5jIHJlYWQoYnVmZmVyLCBvZmZzZXQsIGxlbmd0aCkge1xuICAgICAgICBpZiAobGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgICAgICBsZXQgYnl0ZXNSZWFkID0gdGhpcy5yZWFkRnJvbVBlZWtCdWZmZXIoYnVmZmVyLCBvZmZzZXQsIGxlbmd0aCk7XG4gICAgICAgIGJ5dGVzUmVhZCArPSBhd2FpdCB0aGlzLnJlYWRSZW1haW5kZXJGcm9tU3RyZWFtKGJ1ZmZlciwgb2Zmc2V0ICsgYnl0ZXNSZWFkLCBsZW5ndGggLSBieXRlc1JlYWQpO1xuICAgICAgICBpZiAoYnl0ZXNSZWFkID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRW5kT2ZTdHJlYW1FcnJvcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBieXRlc1JlYWQ7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJlYWQgY2h1bmsgZnJvbSBzdHJlYW1cbiAgICAgKiBAcGFyYW0gYnVmZmVyIC0gVGFyZ2V0IFVpbnQ4QXJyYXkgKG9yIEJ1ZmZlcikgdG8gc3RvcmUgZGF0YSByZWFkIGZyb20gc3RyZWFtIGluXG4gICAgICogQHBhcmFtIG9mZnNldCAtIE9mZnNldCB0YXJnZXRcbiAgICAgKiBAcGFyYW0gbGVuZ3RoIC0gTnVtYmVyIG9mIGJ5dGVzIHRvIHJlYWRcbiAgICAgKiBAcmV0dXJucyBOdW1iZXIgb2YgYnl0ZXMgcmVhZFxuICAgICAqL1xuICAgIHJlYWRGcm9tUGVla0J1ZmZlcihidWZmZXIsIG9mZnNldCwgbGVuZ3RoKSB7XG4gICAgICAgIGxldCByZW1haW5pbmcgPSBsZW5ndGg7XG4gICAgICAgIGxldCBieXRlc1JlYWQgPSAwO1xuICAgICAgICAvLyBjb25zdW1lIHBlZWtlZCBkYXRhIGZpcnN0XG4gICAgICAgIHdoaWxlICh0aGlzLnBlZWtRdWV1ZS5sZW5ndGggPiAwICYmIHJlbWFpbmluZyA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IHBlZWtEYXRhID0gdGhpcy5wZWVrUXVldWUucG9wKCk7IC8vIEZyb250IG9mIHF1ZXVlXG4gICAgICAgICAgICBpZiAoIXBlZWtEYXRhKVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncGVla0RhdGEgc2hvdWxkIGJlIGRlZmluZWQnKTtcbiAgICAgICAgICAgIGNvbnN0IGxlbkNvcHkgPSBNYXRoLm1pbihwZWVrRGF0YS5sZW5ndGgsIHJlbWFpbmluZyk7XG4gICAgICAgICAgICBidWZmZXIuc2V0KHBlZWtEYXRhLnN1YmFycmF5KDAsIGxlbkNvcHkpLCBvZmZzZXQgKyBieXRlc1JlYWQpO1xuICAgICAgICAgICAgYnl0ZXNSZWFkICs9IGxlbkNvcHk7XG4gICAgICAgICAgICByZW1haW5pbmcgLT0gbGVuQ29weTtcbiAgICAgICAgICAgIGlmIChsZW5Db3B5IDwgcGVla0RhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgLy8gcmVtYWluZGVyIGJhY2sgdG8gcXVldWVcbiAgICAgICAgICAgICAgICB0aGlzLnBlZWtRdWV1ZS5wdXNoKHBlZWtEYXRhLnN1YmFycmF5KGxlbkNvcHkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYnl0ZXNSZWFkO1xuICAgIH1cbiAgICBhc3luYyByZWFkUmVtYWluZGVyRnJvbVN0cmVhbShidWZmZXIsIG9mZnNldCwgaW5pdGlhbFJlbWFpbmluZykge1xuICAgICAgICBsZXQgcmVtYWluaW5nID0gaW5pdGlhbFJlbWFpbmluZztcbiAgICAgICAgbGV0IGJ5dGVzUmVhZCA9IDA7XG4gICAgICAgIC8vIENvbnRpbnVlIHJlYWRpbmcgZnJvbSBzdHJlYW0gaWYgcmVxdWlyZWRcbiAgICAgICAgd2hpbGUgKHJlbWFpbmluZyA+IDAgJiYgIXRoaXMuZW5kT2ZTdHJlYW0pIHtcbiAgICAgICAgICAgIGNvbnN0IHJlcUxlbiA9IE1hdGgubWluKHJlbWFpbmluZywgdGhpcy5tYXhTdHJlYW1SZWFkU2l6ZSk7XG4gICAgICAgICAgICBjb25zdCBjaHVua0xlbiA9IGF3YWl0IHRoaXMucmVhZEZyb21TdHJlYW0oYnVmZmVyLCBvZmZzZXQgKyBieXRlc1JlYWQsIHJlcUxlbik7XG4gICAgICAgICAgICBpZiAoY2h1bmtMZW4gPT09IDApXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBieXRlc1JlYWQgKz0gY2h1bmtMZW47XG4gICAgICAgICAgICByZW1haW5pbmcgLT0gY2h1bmtMZW47XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGJ5dGVzUmVhZDtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBFbmRPZlN0cmVhbUVycm9yIH0gZnJvbSAnLi9FbmRPZlN0cmVhbUVycm9yLmpzJztcbmltcG9ydCB7IERlZmVycmVkIH0gZnJvbSAnLi9EZWZlcnJlZC5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdFN0cmVhbVJlYWRlciB9IGZyb20gXCIuL0Fic3RyYWN0U3RyZWFtUmVhZGVyLmpzXCI7XG5leHBvcnQgeyBFbmRPZlN0cmVhbUVycm9yIH0gZnJvbSAnLi9FbmRPZlN0cmVhbUVycm9yLmpzJztcbi8qKlxuICogTm9kZS5qcyBSZWFkYWJsZSBTdHJlYW0gUmVhZGVyXG4gKiBSZWY6IGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvc3RyZWFtLmh0bWwjcmVhZGFibGUtc3RyZWFtc1xuICovXG5leHBvcnQgY2xhc3MgU3RyZWFtUmVhZGVyIGV4dGVuZHMgQWJzdHJhY3RTdHJlYW1SZWFkZXIge1xuICAgIGNvbnN0cnVjdG9yKHMpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5zID0gcztcbiAgICAgICAgLyoqXG4gICAgICAgICAqIERlZmVycmVkIHVzZWQgZm9yIHBvc3Rwb25lZCByZWFkIHJlcXVlc3QgKGFzIG5vdCBkYXRhIGlzIHlldCBhdmFpbGFibGUgdG8gcmVhZClcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZGVmZXJyZWQgPSBudWxsO1xuICAgICAgICBpZiAoIXMucmVhZCB8fCAhcy5vbmNlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIGFuIGluc3RhbmNlIG9mIHN0cmVhbS5SZWFkYWJsZScpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucy5vbmNlKCdlbmQnLCAoKSA9PiB0aGlzLnJlamVjdChuZXcgRW5kT2ZTdHJlYW1FcnJvcigpKSk7XG4gICAgICAgIHRoaXMucy5vbmNlKCdlcnJvcicsIGVyciA9PiB0aGlzLnJlamVjdChlcnIpKTtcbiAgICAgICAgdGhpcy5zLm9uY2UoJ2Nsb3NlJywgKCkgPT4gdGhpcy5yZWplY3QobmV3IEVycm9yKCdTdHJlYW0gY2xvc2VkJykpKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmVhZCBjaHVuayBmcm9tIHN0cmVhbVxuICAgICAqIEBwYXJhbSBidWZmZXIgVGFyZ2V0IFVpbnQ4QXJyYXkgKG9yIEJ1ZmZlcikgdG8gc3RvcmUgZGF0YSByZWFkIGZyb20gc3RyZWFtIGluXG4gICAgICogQHBhcmFtIG9mZnNldCBPZmZzZXQgdGFyZ2V0XG4gICAgICogQHBhcmFtIGxlbmd0aCBOdW1iZXIgb2YgYnl0ZXMgdG8gcmVhZFxuICAgICAqIEByZXR1cm5zIE51bWJlciBvZiBieXRlcyByZWFkXG4gICAgICovXG4gICAgYXN5bmMgcmVhZEZyb21TdHJlYW0oYnVmZmVyLCBvZmZzZXQsIGxlbmd0aCkge1xuICAgICAgICBpZiAodGhpcy5lbmRPZlN0cmVhbSkge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVhZEJ1ZmZlciA9IHRoaXMucy5yZWFkKGxlbmd0aCk7XG4gICAgICAgIGlmIChyZWFkQnVmZmVyKSB7XG4gICAgICAgICAgICBidWZmZXIuc2V0KHJlYWRCdWZmZXIsIG9mZnNldCk7XG4gICAgICAgICAgICByZXR1cm4gcmVhZEJ1ZmZlci5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHtcbiAgICAgICAgICAgIGJ1ZmZlcixcbiAgICAgICAgICAgIG9mZnNldCxcbiAgICAgICAgICAgIGxlbmd0aCxcbiAgICAgICAgICAgIGRlZmVycmVkOiBuZXcgRGVmZXJyZWQoKVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmRlZmVycmVkID0gcmVxdWVzdC5kZWZlcnJlZDtcbiAgICAgICAgdGhpcy5zLm9uY2UoJ3JlYWRhYmxlJywgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5yZWFkRGVmZXJyZWQocmVxdWVzdCk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVxdWVzdC5kZWZlcnJlZC5wcm9taXNlO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBQcm9jZXNzIGRlZmVycmVkIHJlYWQgcmVxdWVzdFxuICAgICAqIEBwYXJhbSByZXF1ZXN0IERlZmVycmVkIHJlYWQgcmVxdWVzdFxuICAgICAqL1xuICAgIHJlYWREZWZlcnJlZChyZXF1ZXN0KSB7XG4gICAgICAgIGNvbnN0IHJlYWRCdWZmZXIgPSB0aGlzLnMucmVhZChyZXF1ZXN0Lmxlbmd0aCk7XG4gICAgICAgIGlmIChyZWFkQnVmZmVyKSB7XG4gICAgICAgICAgICByZXF1ZXN0LmJ1ZmZlci5zZXQocmVhZEJ1ZmZlciwgcmVxdWVzdC5vZmZzZXQpO1xuICAgICAgICAgICAgcmVxdWVzdC5kZWZlcnJlZC5yZXNvbHZlKHJlYWRCdWZmZXIubGVuZ3RoKTtcbiAgICAgICAgICAgIHRoaXMuZGVmZXJyZWQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zLm9uY2UoJ3JlYWRhYmxlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMucmVhZERlZmVycmVkKHJlcXVlc3QpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmVqZWN0KGVycikge1xuICAgICAgICB0aGlzLmVuZE9mU3RyZWFtID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMuZGVmZXJyZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZGVmZXJyZWQucmVqZWN0KGVycik7XG4gICAgICAgICAgICB0aGlzLmRlZmVycmVkID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBhc3luYyBhYm9ydCgpIHtcbiAgICAgICAgdGhpcy5zLmRlc3Ryb3koKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBFbmRPZlN0cmVhbUVycm9yIH0gZnJvbSAncGVlay1yZWFkYWJsZSc7XG4vKipcbiAqIENvcmUgdG9rZW5pemVyXG4gKi9cbmV4cG9ydCBjbGFzcyBBYnN0cmFjdFRva2VuaXplciB7XG4gICAgY29uc3RydWN0b3IoZmlsZUluZm8pIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRva2VuaXplci1zdHJlYW0gcG9zaXRpb25cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucG9zaXRpb24gPSAwO1xuICAgICAgICB0aGlzLm51bUJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KDgpO1xuICAgICAgICB0aGlzLmZpbGVJbmZvID0gZmlsZUluZm8gPyBmaWxlSW5mbyA6IHt9O1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZWFkIGEgdG9rZW4gZnJvbSB0aGUgdG9rZW5pemVyLXN0cmVhbVxuICAgICAqIEBwYXJhbSB0b2tlbiAtIFRoZSB0b2tlbiB0byByZWFkXG4gICAgICogQHBhcmFtIHBvc2l0aW9uIC0gSWYgcHJvdmlkZWQsIHRoZSBkZXNpcmVkIHBvc2l0aW9uIGluIHRoZSB0b2tlbml6ZXItc3RyZWFtXG4gICAgICogQHJldHVybnMgUHJvbWlzZSB3aXRoIHRva2VuIGRhdGFcbiAgICAgKi9cbiAgICBhc3luYyByZWFkVG9rZW4odG9rZW4sIHBvc2l0aW9uID0gdGhpcy5wb3NpdGlvbikge1xuICAgICAgICBjb25zdCB1aW50OEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkodG9rZW4ubGVuKTtcbiAgICAgICAgY29uc3QgbGVuID0gYXdhaXQgdGhpcy5yZWFkQnVmZmVyKHVpbnQ4QXJyYXksIHsgcG9zaXRpb24gfSk7XG4gICAgICAgIGlmIChsZW4gPCB0b2tlbi5sZW4pXG4gICAgICAgICAgICB0aHJvdyBuZXcgRW5kT2ZTdHJlYW1FcnJvcigpO1xuICAgICAgICByZXR1cm4gdG9rZW4uZ2V0KHVpbnQ4QXJyYXksIDApO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBQZWVrIGEgdG9rZW4gZnJvbSB0aGUgdG9rZW5pemVyLXN0cmVhbS5cbiAgICAgKiBAcGFyYW0gdG9rZW4gLSBUb2tlbiB0byBwZWVrIGZyb20gdGhlIHRva2VuaXplci1zdHJlYW0uXG4gICAgICogQHBhcmFtIHBvc2l0aW9uIC0gT2Zmc2V0IHdoZXJlIHRvIGJlZ2luIHJlYWRpbmcgd2l0aGluIHRoZSBmaWxlLiBJZiBwb3NpdGlvbiBpcyBudWxsLCBkYXRhIHdpbGwgYmUgcmVhZCBmcm9tIHRoZSBjdXJyZW50IGZpbGUgcG9zaXRpb24uXG4gICAgICogQHJldHVybnMgUHJvbWlzZSB3aXRoIHRva2VuIGRhdGFcbiAgICAgKi9cbiAgICBhc3luYyBwZWVrVG9rZW4odG9rZW4sIHBvc2l0aW9uID0gdGhpcy5wb3NpdGlvbikge1xuICAgICAgICBjb25zdCB1aW50OEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkodG9rZW4ubGVuKTtcbiAgICAgICAgY29uc3QgbGVuID0gYXdhaXQgdGhpcy5wZWVrQnVmZmVyKHVpbnQ4QXJyYXksIHsgcG9zaXRpb24gfSk7XG4gICAgICAgIGlmIChsZW4gPCB0b2tlbi5sZW4pXG4gICAgICAgICAgICB0aHJvdyBuZXcgRW5kT2ZTdHJlYW1FcnJvcigpO1xuICAgICAgICByZXR1cm4gdG9rZW4uZ2V0KHVpbnQ4QXJyYXksIDApO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZWFkIGEgbnVtZXJpYyB0b2tlbiBmcm9tIHRoZSBzdHJlYW1cbiAgICAgKiBAcGFyYW0gdG9rZW4gLSBOdW1lcmljIHRva2VuXG4gICAgICogQHJldHVybnMgUHJvbWlzZSB3aXRoIG51bWJlclxuICAgICAqL1xuICAgIGFzeW5jIHJlYWROdW1iZXIodG9rZW4pIHtcbiAgICAgICAgY29uc3QgbGVuID0gYXdhaXQgdGhpcy5yZWFkQnVmZmVyKHRoaXMubnVtQnVmZmVyLCB7IGxlbmd0aDogdG9rZW4ubGVuIH0pO1xuICAgICAgICBpZiAobGVuIDwgdG9rZW4ubGVuKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVuZE9mU3RyZWFtRXJyb3IoKTtcbiAgICAgICAgcmV0dXJuIHRva2VuLmdldCh0aGlzLm51bUJ1ZmZlciwgMCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJlYWQgYSBudW1lcmljIHRva2VuIGZyb20gdGhlIHN0cmVhbVxuICAgICAqIEBwYXJhbSB0b2tlbiAtIE51bWVyaWMgdG9rZW5cbiAgICAgKiBAcmV0dXJucyBQcm9taXNlIHdpdGggbnVtYmVyXG4gICAgICovXG4gICAgYXN5bmMgcGVla051bWJlcih0b2tlbikge1xuICAgICAgICBjb25zdCBsZW4gPSBhd2FpdCB0aGlzLnBlZWtCdWZmZXIodGhpcy5udW1CdWZmZXIsIHsgbGVuZ3RoOiB0b2tlbi5sZW4gfSk7XG4gICAgICAgIGlmIChsZW4gPCB0b2tlbi5sZW4pXG4gICAgICAgICAgICB0aHJvdyBuZXcgRW5kT2ZTdHJlYW1FcnJvcigpO1xuICAgICAgICByZXR1cm4gdG9rZW4uZ2V0KHRoaXMubnVtQnVmZmVyLCAwKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogSWdub3JlIG51bWJlciBvZiBieXRlcywgYWR2YW5jZXMgdGhlIHBvaW50ZXIgaW4gdW5kZXIgdG9rZW5pemVyLXN0cmVhbS5cbiAgICAgKiBAcGFyYW0gbGVuZ3RoIC0gTnVtYmVyIG9mIGJ5dGVzIHRvIGlnbm9yZVxuICAgICAqIEByZXR1cm4gcmVzb2x2ZXMgdGhlIG51bWJlciBvZiBieXRlcyBpZ25vcmVkLCBlcXVhbHMgbGVuZ3RoIGlmIHRoaXMgYXZhaWxhYmxlLCBvdGhlcndpc2UgdGhlIG51bWJlciBvZiBieXRlcyBhdmFpbGFibGVcbiAgICAgKi9cbiAgICBhc3luYyBpZ25vcmUobGVuZ3RoKSB7XG4gICAgICAgIGlmICh0aGlzLmZpbGVJbmZvLnNpemUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uc3QgYnl0ZXNMZWZ0ID0gdGhpcy5maWxlSW5mby5zaXplIC0gdGhpcy5wb3NpdGlvbjtcbiAgICAgICAgICAgIGlmIChsZW5ndGggPiBieXRlc0xlZnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBvc2l0aW9uICs9IGJ5dGVzTGVmdDtcbiAgICAgICAgICAgICAgICByZXR1cm4gYnl0ZXNMZWZ0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucG9zaXRpb24gKz0gbGVuZ3RoO1xuICAgICAgICByZXR1cm4gbGVuZ3RoO1xuICAgIH1cbiAgICBhc3luYyBjbG9zZSgpIHtcbiAgICAgICAgLy8gZW1wdHlcbiAgICB9XG4gICAgbm9ybWFsaXplT3B0aW9ucyh1aW50OEFycmF5LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMucG9zaXRpb24gIT09IHVuZGVmaW5lZCAmJiBvcHRpb25zLnBvc2l0aW9uIDwgdGhpcy5wb3NpdGlvbikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdgb3B0aW9ucy5wb3NpdGlvbmAgbXVzdCBiZSBlcXVhbCBvciBncmVhdGVyIHRoYW4gYHRva2VuaXplci5wb3NpdGlvbmAnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBtYXlCZUxlc3M6IG9wdGlvbnMubWF5QmVMZXNzID09PSB0cnVlLFxuICAgICAgICAgICAgICAgIG9mZnNldDogb3B0aW9ucy5vZmZzZXQgPyBvcHRpb25zLm9mZnNldCA6IDAsXG4gICAgICAgICAgICAgICAgbGVuZ3RoOiBvcHRpb25zLmxlbmd0aCA/IG9wdGlvbnMubGVuZ3RoIDogKHVpbnQ4QXJyYXkubGVuZ3RoIC0gKG9wdGlvbnMub2Zmc2V0ID8gb3B0aW9ucy5vZmZzZXQgOiAwKSksXG4gICAgICAgICAgICAgICAgcG9zaXRpb246IG9wdGlvbnMucG9zaXRpb24gPyBvcHRpb25zLnBvc2l0aW9uIDogdGhpcy5wb3NpdGlvblxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbWF5QmVMZXNzOiBmYWxzZSxcbiAgICAgICAgICAgIG9mZnNldDogMCxcbiAgICAgICAgICAgIGxlbmd0aDogdWludDhBcnJheS5sZW5ndGgsXG4gICAgICAgICAgICBwb3NpdGlvbjogdGhpcy5wb3NpdGlvblxuICAgICAgICB9O1xuICAgIH1cbn1cbiIsImltcG9ydCB7IEFic3RyYWN0VG9rZW5pemVyIH0gZnJvbSAnLi9BYnN0cmFjdFRva2VuaXplci5qcyc7XG5pbXBvcnQgeyBFbmRPZlN0cmVhbUVycm9yIH0gZnJvbSAncGVlay1yZWFkYWJsZSc7XG5jb25zdCBtYXhCdWZmZXJTaXplID0gMjU2MDAwO1xuZXhwb3J0IGNsYXNzIFJlYWRTdHJlYW1Ub2tlbml6ZXIgZXh0ZW5kcyBBYnN0cmFjdFRva2VuaXplciB7XG4gICAgY29uc3RydWN0b3Ioc3RyZWFtUmVhZGVyLCBmaWxlSW5mbykge1xuICAgICAgICBzdXBlcihmaWxlSW5mbyk7XG4gICAgICAgIHRoaXMuc3RyZWFtUmVhZGVyID0gc3RyZWFtUmVhZGVyO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBHZXQgZmlsZSBpbmZvcm1hdGlvbiwgYW4gSFRUUC1jbGllbnQgbWF5IGltcGxlbWVudCB0aGlzIGRvaW5nIGEgSEVBRCByZXF1ZXN0XG4gICAgICogQHJldHVybiBQcm9taXNlIHdpdGggZmlsZSBpbmZvcm1hdGlvblxuICAgICAqL1xuICAgIGFzeW5jIGdldEZpbGVJbmZvKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5maWxlSW5mbztcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmVhZCBidWZmZXIgZnJvbSB0b2tlbml6ZXJcbiAgICAgKiBAcGFyYW0gdWludDhBcnJheSAtIFRhcmdldCBVaW50OEFycmF5IHRvIGZpbGwgd2l0aCBkYXRhIHJlYWQgZnJvbSB0aGUgdG9rZW5pemVyLXN0cmVhbVxuICAgICAqIEBwYXJhbSBvcHRpb25zIC0gUmVhZCBiZWhhdmlvdXIgb3B0aW9uc1xuICAgICAqIEByZXR1cm5zIFByb21pc2Ugd2l0aCBudW1iZXIgb2YgYnl0ZXMgcmVhZFxuICAgICAqL1xuICAgIGFzeW5jIHJlYWRCdWZmZXIodWludDhBcnJheSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBub3JtT3B0aW9ucyA9IHRoaXMubm9ybWFsaXplT3B0aW9ucyh1aW50OEFycmF5LCBvcHRpb25zKTtcbiAgICAgICAgY29uc3Qgc2tpcEJ5dGVzID0gbm9ybU9wdGlvbnMucG9zaXRpb24gLSB0aGlzLnBvc2l0aW9uO1xuICAgICAgICBpZiAoc2tpcEJ5dGVzID4gMCkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5pZ25vcmUoc2tpcEJ5dGVzKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlYWRCdWZmZXIodWludDhBcnJheSwgb3B0aW9ucyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc2tpcEJ5dGVzIDwgMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdgb3B0aW9ucy5wb3NpdGlvbmAgbXVzdCBiZSBlcXVhbCBvciBncmVhdGVyIHRoYW4gYHRva2VuaXplci5wb3NpdGlvbmAnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9ybU9wdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBieXRlc1JlYWQgPSBhd2FpdCB0aGlzLnN0cmVhbVJlYWRlci5yZWFkKHVpbnQ4QXJyYXksIG5vcm1PcHRpb25zLm9mZnNldCwgbm9ybU9wdGlvbnMubGVuZ3RoKTtcbiAgICAgICAgdGhpcy5wb3NpdGlvbiArPSBieXRlc1JlYWQ7XG4gICAgICAgIGlmICgoIW9wdGlvbnMgfHwgIW9wdGlvbnMubWF5QmVMZXNzKSAmJiBieXRlc1JlYWQgPCBub3JtT3B0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFbmRPZlN0cmVhbUVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGJ5dGVzUmVhZDtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUGVlayAocmVhZCBhaGVhZCkgYnVmZmVyIGZyb20gdG9rZW5pemVyXG4gICAgICogQHBhcmFtIHVpbnQ4QXJyYXkgLSBVaW50OEFycmF5IChvciBCdWZmZXIpIHRvIHdyaXRlIGRhdGEgdG9cbiAgICAgKiBAcGFyYW0gb3B0aW9ucyAtIFJlYWQgYmVoYXZpb3VyIG9wdGlvbnNcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlIHdpdGggbnVtYmVyIG9mIGJ5dGVzIHBlZWtlZFxuICAgICAqL1xuICAgIGFzeW5jIHBlZWtCdWZmZXIodWludDhBcnJheSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBub3JtT3B0aW9ucyA9IHRoaXMubm9ybWFsaXplT3B0aW9ucyh1aW50OEFycmF5LCBvcHRpb25zKTtcbiAgICAgICAgbGV0IGJ5dGVzUmVhZCA9IDA7XG4gICAgICAgIGlmIChub3JtT3B0aW9ucy5wb3NpdGlvbikge1xuICAgICAgICAgICAgY29uc3Qgc2tpcEJ5dGVzID0gbm9ybU9wdGlvbnMucG9zaXRpb24gLSB0aGlzLnBvc2l0aW9uO1xuICAgICAgICAgICAgaWYgKHNraXBCeXRlcyA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBza2lwQnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkobm9ybU9wdGlvbnMubGVuZ3RoICsgc2tpcEJ5dGVzKTtcbiAgICAgICAgICAgICAgICBieXRlc1JlYWQgPSBhd2FpdCB0aGlzLnBlZWtCdWZmZXIoc2tpcEJ1ZmZlciwgeyBtYXlCZUxlc3M6IG5vcm1PcHRpb25zLm1heUJlTGVzcyB9KTtcbiAgICAgICAgICAgICAgICB1aW50OEFycmF5LnNldChza2lwQnVmZmVyLnN1YmFycmF5KHNraXBCeXRlcyksIG5vcm1PcHRpb25zLm9mZnNldCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ5dGVzUmVhZCAtIHNraXBCeXRlcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHNraXBCeXRlcyA8IDApIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBwZWVrIGZyb20gYSBuZWdhdGl2ZSBvZmZzZXQgaW4gYSBzdHJlYW0nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAobm9ybU9wdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBieXRlc1JlYWQgPSBhd2FpdCB0aGlzLnN0cmVhbVJlYWRlci5wZWVrKHVpbnQ4QXJyYXksIG5vcm1PcHRpb25zLm9mZnNldCwgbm9ybU9wdGlvbnMubGVuZ3RoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLm1heUJlTGVzcyAmJiBlcnIgaW5zdGFuY2VvZiBFbmRPZlN0cmVhbUVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoKCFub3JtT3B0aW9ucy5tYXlCZUxlc3MpICYmIGJ5dGVzUmVhZCA8IG5vcm1PcHRpb25zLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFbmRPZlN0cmVhbUVycm9yKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGJ5dGVzUmVhZDtcbiAgICB9XG4gICAgYXN5bmMgaWdub3JlKGxlbmd0aCkge1xuICAgICAgICAvLyBkZWJ1ZyhgaWdub3JlICR7dGhpcy5wb3NpdGlvbn0uLi4ke3RoaXMucG9zaXRpb24gKyBsZW5ndGggLSAxfWApO1xuICAgICAgICBjb25zdCBidWZTaXplID0gTWF0aC5taW4obWF4QnVmZmVyU2l6ZSwgbGVuZ3RoKTtcbiAgICAgICAgY29uc3QgYnVmID0gbmV3IFVpbnQ4QXJyYXkoYnVmU2l6ZSk7XG4gICAgICAgIGxldCB0b3RCeXRlc1JlYWQgPSAwO1xuICAgICAgICB3aGlsZSAodG90Qnl0ZXNSZWFkIDwgbGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zdCByZW1haW5pbmcgPSBsZW5ndGggLSB0b3RCeXRlc1JlYWQ7XG4gICAgICAgICAgICBjb25zdCBieXRlc1JlYWQgPSBhd2FpdCB0aGlzLnJlYWRCdWZmZXIoYnVmLCB7IGxlbmd0aDogTWF0aC5taW4oYnVmU2l6ZSwgcmVtYWluaW5nKSB9KTtcbiAgICAgICAgICAgIGlmIChieXRlc1JlYWQgPCAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ5dGVzUmVhZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRvdEJ5dGVzUmVhZCArPSBieXRlc1JlYWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRvdEJ5dGVzUmVhZDtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBFbmRPZlN0cmVhbUVycm9yIH0gZnJvbSAncGVlay1yZWFkYWJsZSc7XG5pbXBvcnQgeyBBYnN0cmFjdFRva2VuaXplciB9IGZyb20gJy4vQWJzdHJhY3RUb2tlbml6ZXIuanMnO1xuZXhwb3J0IGNsYXNzIEJ1ZmZlclRva2VuaXplciBleHRlbmRzIEFic3RyYWN0VG9rZW5pemVyIHtcbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3QgQnVmZmVyVG9rZW5pemVyXG4gICAgICogQHBhcmFtIHVpbnQ4QXJyYXkgLSBVaW50OEFycmF5IHRvIHRva2VuaXplXG4gICAgICogQHBhcmFtIGZpbGVJbmZvIC0gUGFzcyBhZGRpdGlvbmFsIGZpbGUgaW5mb3JtYXRpb24gdG8gdGhlIHRva2VuaXplclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHVpbnQ4QXJyYXksIGZpbGVJbmZvKSB7XG4gICAgICAgIHN1cGVyKGZpbGVJbmZvKTtcbiAgICAgICAgdGhpcy51aW50OEFycmF5ID0gdWludDhBcnJheTtcbiAgICAgICAgdGhpcy5maWxlSW5mby5zaXplID0gdGhpcy5maWxlSW5mby5zaXplID8gdGhpcy5maWxlSW5mby5zaXplIDogdWludDhBcnJheS5sZW5ndGg7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJlYWQgYnVmZmVyIGZyb20gdG9rZW5pemVyXG4gICAgICogQHBhcmFtIHVpbnQ4QXJyYXkgLSBVaW50OEFycmF5IHRvIHRva2VuaXplXG4gICAgICogQHBhcmFtIG9wdGlvbnMgLSBSZWFkIGJlaGF2aW91ciBvcHRpb25zXG4gICAgICogQHJldHVybnMge1Byb21pc2U8bnVtYmVyPn1cbiAgICAgKi9cbiAgICBhc3luYyByZWFkQnVmZmVyKHVpbnQ4QXJyYXksIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5wb3NpdGlvbikge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMucG9zaXRpb24gPCB0aGlzLnBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdgb3B0aW9ucy5wb3NpdGlvbmAgbXVzdCBiZSBlcXVhbCBvciBncmVhdGVyIHRoYW4gYHRva2VuaXplci5wb3NpdGlvbmAnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucG9zaXRpb24gPSBvcHRpb25zLnBvc2l0aW9uO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGJ5dGVzUmVhZCA9IGF3YWl0IHRoaXMucGVla0J1ZmZlcih1aW50OEFycmF5LCBvcHRpb25zKTtcbiAgICAgICAgdGhpcy5wb3NpdGlvbiArPSBieXRlc1JlYWQ7XG4gICAgICAgIHJldHVybiBieXRlc1JlYWQ7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFBlZWsgKHJlYWQgYWhlYWQpIGJ1ZmZlciBmcm9tIHRva2VuaXplclxuICAgICAqIEBwYXJhbSB1aW50OEFycmF5XG4gICAgICogQHBhcmFtIG9wdGlvbnMgLSBSZWFkIGJlaGF2aW91ciBvcHRpb25zXG4gICAgICogQHJldHVybnMge1Byb21pc2U8bnVtYmVyPn1cbiAgICAgKi9cbiAgICBhc3luYyBwZWVrQnVmZmVyKHVpbnQ4QXJyYXksIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3Qgbm9ybU9wdGlvbnMgPSB0aGlzLm5vcm1hbGl6ZU9wdGlvbnModWludDhBcnJheSwgb3B0aW9ucyk7XG4gICAgICAgIGNvbnN0IGJ5dGVzMnJlYWQgPSBNYXRoLm1pbih0aGlzLnVpbnQ4QXJyYXkubGVuZ3RoIC0gbm9ybU9wdGlvbnMucG9zaXRpb24sIG5vcm1PcHRpb25zLmxlbmd0aCk7XG4gICAgICAgIGlmICgoIW5vcm1PcHRpb25zLm1heUJlTGVzcykgJiYgYnl0ZXMycmVhZCA8IG5vcm1PcHRpb25zLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVuZE9mU3RyZWFtRXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHVpbnQ4QXJyYXkuc2V0KHRoaXMudWludDhBcnJheS5zdWJhcnJheShub3JtT3B0aW9ucy5wb3NpdGlvbiwgbm9ybU9wdGlvbnMucG9zaXRpb24gKyBieXRlczJyZWFkKSwgbm9ybU9wdGlvbnMub2Zmc2V0KTtcbiAgICAgICAgICAgIHJldHVybiBieXRlczJyZWFkO1xuICAgICAgICB9XG4gICAgfVxuICAgIGFzeW5jIGNsb3NlKCkge1xuICAgICAgICAvLyBlbXB0eVxuICAgIH1cbn1cbiIsImltcG9ydCB7IFJlYWRTdHJlYW1Ub2tlbml6ZXIgfSBmcm9tICcuL1JlYWRTdHJlYW1Ub2tlbml6ZXIuanMnO1xuaW1wb3J0IHsgQnVmZmVyVG9rZW5pemVyIH0gZnJvbSAnLi9CdWZmZXJUb2tlbml6ZXIuanMnO1xuaW1wb3J0IHsgU3RyZWFtUmVhZGVyLCBXZWJTdHJlYW1SZWFkZXIgfSBmcm9tICdwZWVrLXJlYWRhYmxlJztcbmV4cG9ydCB7IEVuZE9mU3RyZWFtRXJyb3IgfSBmcm9tICdwZWVrLXJlYWRhYmxlJztcbi8qKlxuICogQ29uc3RydWN0IFJlYWRTdHJlYW1Ub2tlbml6ZXIgZnJvbSBnaXZlbiBTdHJlYW0uXG4gKiBXaWxsIHNldCBmaWxlU2l6ZSwgaWYgcHJvdmlkZWQgZ2l2ZW4gU3RyZWFtIGhhcyBzZXQgdGhlIC5wYXRoIHByb3BlcnR5L1xuICogQHBhcmFtIHN0cmVhbSAtIFJlYWQgZnJvbSBOb2RlLmpzIFN0cmVhbS5SZWFkYWJsZVxuICogQHBhcmFtIGZpbGVJbmZvIC0gUGFzcyB0aGUgZmlsZSBpbmZvcm1hdGlvbiwgbGlrZSBzaXplIGFuZCBNSU1FLXR5cGUgb2YgdGhlIGNvcnJlc3BvbmRpbmcgc3RyZWFtLlxuICogQHJldHVybnMgUmVhZFN0cmVhbVRva2VuaXplclxuICovXG5leHBvcnQgZnVuY3Rpb24gZnJvbVN0cmVhbShzdHJlYW0sIGZpbGVJbmZvKSB7XG4gICAgZmlsZUluZm8gPSBmaWxlSW5mbyA/IGZpbGVJbmZvIDoge307XG4gICAgcmV0dXJuIG5ldyBSZWFkU3RyZWFtVG9rZW5pemVyKG5ldyBTdHJlYW1SZWFkZXIoc3RyZWFtKSwgZmlsZUluZm8pO1xufVxuLyoqXG4gKiBDb25zdHJ1Y3QgUmVhZFN0cmVhbVRva2VuaXplciBmcm9tIGdpdmVuIFJlYWRhYmxlU3RyZWFtIChXZWJTdHJlYW0gQVBJKS5cbiAqIFdpbGwgc2V0IGZpbGVTaXplLCBpZiBwcm92aWRlZCBnaXZlbiBTdHJlYW0gaGFzIHNldCB0aGUgLnBhdGggcHJvcGVydHkvXG4gKiBAcGFyYW0gd2ViU3RyZWFtIC0gUmVhZCBmcm9tIE5vZGUuanMgU3RyZWFtLlJlYWRhYmxlXG4gKiBAcGFyYW0gZmlsZUluZm8gLSBQYXNzIHRoZSBmaWxlIGluZm9ybWF0aW9uLCBsaWtlIHNpemUgYW5kIE1JTUUtdHlwZSBvZiB0aGUgY29ycmVzcG9uZGluZyBzdHJlYW0uXG4gKiBAcmV0dXJucyBSZWFkU3RyZWFtVG9rZW5pemVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmcm9tV2ViU3RyZWFtKHdlYlN0cmVhbSwgZmlsZUluZm8pIHtcbiAgICBmaWxlSW5mbyA9IGZpbGVJbmZvID8gZmlsZUluZm8gOiB7fTtcbiAgICByZXR1cm4gbmV3IFJlYWRTdHJlYW1Ub2tlbml6ZXIobmV3IFdlYlN0cmVhbVJlYWRlcih3ZWJTdHJlYW0pLCBmaWxlSW5mbyk7XG59XG4vKipcbiAqIENvbnN0cnVjdCBSZWFkU3RyZWFtVG9rZW5pemVyIGZyb20gZ2l2ZW4gQnVmZmVyLlxuICogQHBhcmFtIHVpbnQ4QXJyYXkgLSBVaW50OEFycmF5IHRvIHRva2VuaXplXG4gKiBAcGFyYW0gZmlsZUluZm8gLSBQYXNzIGFkZGl0aW9uYWwgZmlsZSBpbmZvcm1hdGlvbiB0byB0aGUgdG9rZW5pemVyXG4gKiBAcmV0dXJucyBCdWZmZXJUb2tlbml6ZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZyb21CdWZmZXIodWludDhBcnJheSwgZmlsZUluZm8pIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlclRva2VuaXplcih1aW50OEFycmF5LCBmaWxlSW5mbyk7XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gc3RyaW5nVG9CeXRlcyhzdHJpbmcpIHtcblx0cmV0dXJuIFsuLi5zdHJpbmddLm1hcChjaGFyYWN0ZXIgPT4gY2hhcmFjdGVyLmNoYXJDb2RlQXQoMCkpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIHVuaWNvcm4vcHJlZmVyLWNvZGUtcG9pbnRcbn1cblxuLyoqXG5DaGVja3Mgd2hldGhlciB0aGUgVEFSIGNoZWNrc3VtIGlzIHZhbGlkLlxuXG5AcGFyYW0ge0J1ZmZlcn0gYnVmZmVyIC0gVGhlIFRBUiBoZWFkZXIgYFtvZmZzZXQgLi4uIG9mZnNldCArIDUxMl1gLlxuQHBhcmFtIHtudW1iZXJ9IG9mZnNldCAtIFRBUiBoZWFkZXIgb2Zmc2V0LlxuQHJldHVybnMge2Jvb2xlYW59IGB0cnVlYCBpZiB0aGUgVEFSIGNoZWNrc3VtIGlzIHZhbGlkLCBvdGhlcndpc2UgYGZhbHNlYC5cbiovXG5leHBvcnQgZnVuY3Rpb24gdGFySGVhZGVyQ2hlY2tzdW1NYXRjaGVzKGJ1ZmZlciwgb2Zmc2V0ID0gMCkge1xuXHRjb25zdCByZWFkU3VtID0gTnVtYmVyLnBhcnNlSW50KGJ1ZmZlci50b1N0cmluZygndXRmOCcsIDE0OCwgMTU0KS5yZXBsYWNlKC9cXDAuKiQvLCAnJykudHJpbSgpLCA4KTsgLy8gUmVhZCBzdW0gaW4gaGVhZGVyXG5cdGlmIChOdW1iZXIuaXNOYU4ocmVhZFN1bSkpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRsZXQgc3VtID0gOCAqIDB4MjA7IC8vIEluaXRpYWxpemUgc2lnbmVkIGJpdCBzdW1cblxuXHRmb3IgKGxldCBpbmRleCA9IG9mZnNldDsgaW5kZXggPCBvZmZzZXQgKyAxNDg7IGluZGV4KyspIHtcblx0XHRzdW0gKz0gYnVmZmVyW2luZGV4XTtcblx0fVxuXG5cdGZvciAobGV0IGluZGV4ID0gb2Zmc2V0ICsgMTU2OyBpbmRleCA8IG9mZnNldCArIDUxMjsgaW5kZXgrKykge1xuXHRcdHN1bSArPSBidWZmZXJbaW5kZXhdO1xuXHR9XG5cblx0cmV0dXJuIHJlYWRTdW0gPT09IHN1bTtcbn1cblxuLyoqXG5JRDMgVUlOVDMyIHN5bmMtc2FmZSB0b2tlbml6ZXIgdG9rZW4uXG4yOCBiaXRzIChyZXByZXNlbnRpbmcgdXAgdG8gMjU2TUIpIGludGVnZXIsIHRoZSBtc2IgaXMgMCB0byBhdm9pZCBcImZhbHNlIHN5bmNzaWduYWxzXCIuXG4qL1xuZXhwb3J0IGNvbnN0IHVpbnQzMlN5bmNTYWZlVG9rZW4gPSB7XG5cdGdldDogKGJ1ZmZlciwgb2Zmc2V0KSA9PiAoYnVmZmVyW29mZnNldCArIDNdICYgMHg3RikgfCAoKGJ1ZmZlcltvZmZzZXQgKyAyXSkgPDwgNykgfCAoKGJ1ZmZlcltvZmZzZXQgKyAxXSkgPDwgMTQpIHwgKChidWZmZXJbb2Zmc2V0XSkgPDwgMjEpLFxuXHRsZW46IDQsXG59O1xuIiwiZXhwb3J0IGNvbnN0IGV4dGVuc2lvbnMgPSBbXG5cdCdqcGcnLFxuXHQncG5nJyxcblx0J2FwbmcnLFxuXHQnZ2lmJyxcblx0J3dlYnAnLFxuXHQnZmxpZicsXG5cdCd4Y2YnLFxuXHQnY3IyJyxcblx0J2NyMycsXG5cdCdvcmYnLFxuXHQnYXJ3Jyxcblx0J2RuZycsXG5cdCduZWYnLFxuXHQncncyJyxcblx0J3JhZicsXG5cdCd0aWYnLFxuXHQnYm1wJyxcblx0J2ljbnMnLFxuXHQnanhyJyxcblx0J3BzZCcsXG5cdCdpbmRkJyxcblx0J3ppcCcsXG5cdCd0YXInLFxuXHQncmFyJyxcblx0J2d6Jyxcblx0J2J6MicsXG5cdCc3eicsXG5cdCdkbWcnLFxuXHQnbXA0Jyxcblx0J21pZCcsXG5cdCdta3YnLFxuXHQnd2VibScsXG5cdCdtb3YnLFxuXHQnYXZpJyxcblx0J21wZycsXG5cdCdtcDInLFxuXHQnbXAzJyxcblx0J200YScsXG5cdCdvZ2EnLFxuXHQnb2dnJyxcblx0J29ndicsXG5cdCdvcHVzJyxcblx0J2ZsYWMnLFxuXHQnd2F2Jyxcblx0J3NweCcsXG5cdCdhbXInLFxuXHQncGRmJyxcblx0J2VwdWInLFxuXHQnZWxmJyxcblx0J21hY2hvJyxcblx0J2V4ZScsXG5cdCdzd2YnLFxuXHQncnRmJyxcblx0J3dhc20nLFxuXHQnd29mZicsXG5cdCd3b2ZmMicsXG5cdCdlb3QnLFxuXHQndHRmJyxcblx0J290ZicsXG5cdCdpY28nLFxuXHQnZmx2Jyxcblx0J3BzJyxcblx0J3h6Jyxcblx0J3NxbGl0ZScsXG5cdCduZXMnLFxuXHQnY3J4Jyxcblx0J3hwaScsXG5cdCdjYWInLFxuXHQnZGViJyxcblx0J2FyJyxcblx0J3JwbScsXG5cdCdaJyxcblx0J2x6Jyxcblx0J2NmYicsXG5cdCdteGYnLFxuXHQnbXRzJyxcblx0J2JsZW5kJyxcblx0J2JwZycsXG5cdCdkb2N4Jyxcblx0J3BwdHgnLFxuXHQneGxzeCcsXG5cdCczZ3AnLFxuXHQnM2cyJyxcblx0J2oyYycsXG5cdCdqcDInLFxuXHQnanBtJyxcblx0J2pweCcsXG5cdCdtajInLFxuXHQnYWlmJyxcblx0J3FjcCcsXG5cdCdvZHQnLFxuXHQnb2RzJyxcblx0J29kcCcsXG5cdCd4bWwnLFxuXHQnbW9iaScsXG5cdCdoZWljJyxcblx0J2N1cicsXG5cdCdrdHgnLFxuXHQnYXBlJyxcblx0J3d2Jyxcblx0J2RjbScsXG5cdCdpY3MnLFxuXHQnZ2xiJyxcblx0J3BjYXAnLFxuXHQnZHNmJyxcblx0J2xuaycsXG5cdCdhbGlhcycsXG5cdCd2b2MnLFxuXHQnYWMzJyxcblx0J200dicsXG5cdCdtNHAnLFxuXHQnbTRiJyxcblx0J2Y0dicsXG5cdCdmNHAnLFxuXHQnZjRiJyxcblx0J2Y0YScsXG5cdCdtaWUnLFxuXHQnYXNmJyxcblx0J29nbScsXG5cdCdvZ3gnLFxuXHQnbXBjJyxcblx0J2Fycm93Jyxcblx0J3NocCcsXG5cdCdhYWMnLFxuXHQnbXAxJyxcblx0J2l0Jyxcblx0J3MzbScsXG5cdCd4bScsXG5cdCdhaScsXG5cdCdza3AnLFxuXHQnYXZpZicsXG5cdCdlcHMnLFxuXHQnbHpoJyxcblx0J3BncCcsXG5cdCdhc2FyJyxcblx0J3N0bCcsXG5cdCdjaG0nLFxuXHQnM21mJyxcblx0J3pzdCcsXG5cdCdqeGwnLFxuXHQndmNmJyxcblx0J2pscycsXG5cdCdwc3QnLFxuXHQnZHdnJyxcblx0J3BhcnF1ZXQnLFxuXHQnY2xhc3MnLFxuXHQnYXJqJyxcblx0J2NwaW8nLFxuXHQnYWNlJyxcblx0J2F2cm8nLFxuXHQnaWNjJyxcblx0J2ZieCcsXG5dO1xuXG5leHBvcnQgY29uc3QgbWltZVR5cGVzID0gW1xuXHQnaW1hZ2UvanBlZycsXG5cdCdpbWFnZS9wbmcnLFxuXHQnaW1hZ2UvZ2lmJyxcblx0J2ltYWdlL3dlYnAnLFxuXHQnaW1hZ2UvZmxpZicsXG5cdCdpbWFnZS94LXhjZicsXG5cdCdpbWFnZS94LWNhbm9uLWNyMicsXG5cdCdpbWFnZS94LWNhbm9uLWNyMycsXG5cdCdpbWFnZS90aWZmJyxcblx0J2ltYWdlL2JtcCcsXG5cdCdpbWFnZS92bmQubXMtcGhvdG8nLFxuXHQnaW1hZ2Uvdm5kLmFkb2JlLnBob3Rvc2hvcCcsXG5cdCdhcHBsaWNhdGlvbi94LWluZGVzaWduJyxcblx0J2FwcGxpY2F0aW9uL2VwdWIremlwJyxcblx0J2FwcGxpY2F0aW9uL3gteHBpbnN0YWxsJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQudGV4dCcsXG5cdCdhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LnNwcmVhZHNoZWV0Jyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQucHJlc2VudGF0aW9uJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC53b3JkcHJvY2Vzc2luZ21sLmRvY3VtZW50Jyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC5wcmVzZW50YXRpb25tbC5wcmVzZW50YXRpb24nLFxuXHQnYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LnNwcmVhZHNoZWV0bWwuc2hlZXQnLFxuXHQnYXBwbGljYXRpb24vemlwJyxcblx0J2FwcGxpY2F0aW9uL3gtdGFyJyxcblx0J2FwcGxpY2F0aW9uL3gtcmFyLWNvbXByZXNzZWQnLFxuXHQnYXBwbGljYXRpb24vZ3ppcCcsXG5cdCdhcHBsaWNhdGlvbi94LWJ6aXAyJyxcblx0J2FwcGxpY2F0aW9uL3gtN3otY29tcHJlc3NlZCcsXG5cdCdhcHBsaWNhdGlvbi94LWFwcGxlLWRpc2tpbWFnZScsXG5cdCdhcHBsaWNhdGlvbi94LWFwYWNoZS1hcnJvdycsXG5cdCd2aWRlby9tcDQnLFxuXHQnYXVkaW8vbWlkaScsXG5cdCd2aWRlby94LW1hdHJvc2thJyxcblx0J3ZpZGVvL3dlYm0nLFxuXHQndmlkZW8vcXVpY2t0aW1lJyxcblx0J3ZpZGVvL3ZuZC5hdmknLFxuXHQnYXVkaW8vdm5kLndhdmUnLFxuXHQnYXVkaW8vcWNlbHAnLFxuXHQnYXVkaW8veC1tcy1hc2YnLFxuXHQndmlkZW8veC1tcy1hc2YnLFxuXHQnYXBwbGljYXRpb24vdm5kLm1zLWFzZicsXG5cdCd2aWRlby9tcGVnJyxcblx0J3ZpZGVvLzNncHAnLFxuXHQnYXVkaW8vbXBlZycsXG5cdCdhdWRpby9tcDQnLCAvLyBSRkMgNDMzN1xuXHQnYXVkaW8vb3B1cycsXG5cdCd2aWRlby9vZ2cnLFxuXHQnYXVkaW8vb2dnJyxcblx0J2FwcGxpY2F0aW9uL29nZycsXG5cdCdhdWRpby94LWZsYWMnLFxuXHQnYXVkaW8vYXBlJyxcblx0J2F1ZGlvL3dhdnBhY2snLFxuXHQnYXVkaW8vYW1yJyxcblx0J2FwcGxpY2F0aW9uL3BkZicsXG5cdCdhcHBsaWNhdGlvbi94LWVsZicsXG5cdCdhcHBsaWNhdGlvbi94LW1hY2gtYmluYXJ5Jyxcblx0J2FwcGxpY2F0aW9uL3gtbXNkb3dubG9hZCcsXG5cdCdhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaCcsXG5cdCdhcHBsaWNhdGlvbi9ydGYnLFxuXHQnYXBwbGljYXRpb24vd2FzbScsXG5cdCdmb250L3dvZmYnLFxuXHQnZm9udC93b2ZmMicsXG5cdCdhcHBsaWNhdGlvbi92bmQubXMtZm9udG9iamVjdCcsXG5cdCdmb250L3R0ZicsXG5cdCdmb250L290ZicsXG5cdCdpbWFnZS94LWljb24nLFxuXHQndmlkZW8veC1mbHYnLFxuXHQnYXBwbGljYXRpb24vcG9zdHNjcmlwdCcsXG5cdCdhcHBsaWNhdGlvbi9lcHMnLFxuXHQnYXBwbGljYXRpb24veC14eicsXG5cdCdhcHBsaWNhdGlvbi94LXNxbGl0ZTMnLFxuXHQnYXBwbGljYXRpb24veC1uaW50ZW5kby1uZXMtcm9tJyxcblx0J2FwcGxpY2F0aW9uL3gtZ29vZ2xlLWNocm9tZS1leHRlbnNpb24nLFxuXHQnYXBwbGljYXRpb24vdm5kLm1zLWNhYi1jb21wcmVzc2VkJyxcblx0J2FwcGxpY2F0aW9uL3gtZGViJyxcblx0J2FwcGxpY2F0aW9uL3gtdW5peC1hcmNoaXZlJyxcblx0J2FwcGxpY2F0aW9uL3gtcnBtJyxcblx0J2FwcGxpY2F0aW9uL3gtY29tcHJlc3MnLFxuXHQnYXBwbGljYXRpb24veC1semlwJyxcblx0J2FwcGxpY2F0aW9uL3gtY2ZiJyxcblx0J2FwcGxpY2F0aW9uL3gtbWllJyxcblx0J2FwcGxpY2F0aW9uL214ZicsXG5cdCd2aWRlby9tcDJ0Jyxcblx0J2FwcGxpY2F0aW9uL3gtYmxlbmRlcicsXG5cdCdpbWFnZS9icGcnLFxuXHQnaW1hZ2UvajJjJyxcblx0J2ltYWdlL2pwMicsXG5cdCdpbWFnZS9qcHgnLFxuXHQnaW1hZ2UvanBtJyxcblx0J2ltYWdlL21qMicsXG5cdCdhdWRpby9haWZmJyxcblx0J2FwcGxpY2F0aW9uL3htbCcsXG5cdCdhcHBsaWNhdGlvbi94LW1vYmlwb2NrZXQtZWJvb2snLFxuXHQnaW1hZ2UvaGVpZicsXG5cdCdpbWFnZS9oZWlmLXNlcXVlbmNlJyxcblx0J2ltYWdlL2hlaWMnLFxuXHQnaW1hZ2UvaGVpYy1zZXF1ZW5jZScsXG5cdCdpbWFnZS9pY25zJyxcblx0J2ltYWdlL2t0eCcsXG5cdCdhcHBsaWNhdGlvbi9kaWNvbScsXG5cdCdhdWRpby94LW11c2VwYWNrJyxcblx0J3RleHQvY2FsZW5kYXInLFxuXHQndGV4dC92Y2FyZCcsXG5cdCdtb2RlbC9nbHRmLWJpbmFyeScsXG5cdCdhcHBsaWNhdGlvbi92bmQudGNwZHVtcC5wY2FwJyxcblx0J2F1ZGlvL3gtZHNmJywgLy8gTm9uLXN0YW5kYXJkXG5cdCdhcHBsaWNhdGlvbi94Lm1zLnNob3J0Y3V0JywgLy8gSW52ZW50ZWQgYnkgdXNcblx0J2FwcGxpY2F0aW9uL3guYXBwbGUuYWxpYXMnLCAvLyBJbnZlbnRlZCBieSB1c1xuXHQnYXVkaW8veC12b2MnLFxuXHQnYXVkaW8vdm5kLmRvbGJ5LmRkLXJhdycsXG5cdCdhdWRpby94LW00YScsXG5cdCdpbWFnZS9hcG5nJyxcblx0J2ltYWdlL3gtb2x5bXB1cy1vcmYnLFxuXHQnaW1hZ2UveC1zb255LWFydycsXG5cdCdpbWFnZS94LWFkb2JlLWRuZycsXG5cdCdpbWFnZS94LW5pa29uLW5lZicsXG5cdCdpbWFnZS94LXBhbmFzb25pYy1ydzInLFxuXHQnaW1hZ2UveC1mdWppZmlsbS1yYWYnLFxuXHQndmlkZW8veC1tNHYnLFxuXHQndmlkZW8vM2dwcDInLFxuXHQnYXBwbGljYXRpb24veC1lc3JpLXNoYXBlJyxcblx0J2F1ZGlvL2FhYycsXG5cdCdhdWRpby94LWl0Jyxcblx0J2F1ZGlvL3gtczNtJyxcblx0J2F1ZGlvL3gteG0nLFxuXHQndmlkZW8vTVAxUycsXG5cdCd2aWRlby9NUDJQJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5za2V0Y2h1cC5za3AnLFxuXHQnaW1hZ2UvYXZpZicsXG5cdCdhcHBsaWNhdGlvbi94LWx6aC1jb21wcmVzc2VkJyxcblx0J2FwcGxpY2F0aW9uL3BncC1lbmNyeXB0ZWQnLFxuXHQnYXBwbGljYXRpb24veC1hc2FyJyxcblx0J21vZGVsL3N0bCcsXG5cdCdhcHBsaWNhdGlvbi92bmQubXMtaHRtbGhlbHAnLFxuXHQnbW9kZWwvM21mJyxcblx0J2ltYWdlL2p4bCcsXG5cdCdhcHBsaWNhdGlvbi96c3RkJyxcblx0J2ltYWdlL2pscycsXG5cdCdhcHBsaWNhdGlvbi92bmQubXMtb3V0bG9vaycsXG5cdCdpbWFnZS92bmQuZHdnJyxcblx0J2FwcGxpY2F0aW9uL3gtcGFycXVldCcsXG5cdCdhcHBsaWNhdGlvbi9qYXZhLXZtJyxcblx0J2FwcGxpY2F0aW9uL3gtYXJqJyxcblx0J2FwcGxpY2F0aW9uL3gtY3BpbycsXG5cdCdhcHBsaWNhdGlvbi94LWFjZS1jb21wcmVzc2VkJyxcblx0J2FwcGxpY2F0aW9uL2F2cm8nLFxuXHQnYXBwbGljYXRpb24vdm5kLmljY3Byb2ZpbGUnLFxuXHQnYXBwbGljYXRpb24veC5hdXRvZGVzay5mYngnLCAvLyBJbnZlbnRlZCBieSB1c1xuXTtcbiIsImltcG9ydCB7QnVmZmVyfSBmcm9tICdub2RlOmJ1ZmZlcic7XG5pbXBvcnQgKiBhcyBUb2tlbiBmcm9tICd0b2tlbi10eXBlcyc7XG5pbXBvcnQgKiBhcyBzdHJ0b2szIGZyb20gJ3N0cnRvazMvY29yZSc7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbi9maWxlLWV4dGVuc2lvbi1pbi1pbXBvcnRcbmltcG9ydCB7XG5cdHN0cmluZ1RvQnl0ZXMsXG5cdHRhckhlYWRlckNoZWNrc3VtTWF0Y2hlcyxcblx0dWludDMyU3luY1NhZmVUb2tlbixcbn0gZnJvbSAnLi91dGlsLmpzJztcbmltcG9ydCB7ZXh0ZW5zaW9ucywgbWltZVR5cGVzfSBmcm9tICcuL3N1cHBvcnRlZC5qcyc7XG5cbmNvbnN0IG1pbmltdW1CeXRlcyA9IDQxMDA7IC8vIEEgZmFpciBhbW91bnQgb2YgZmlsZS10eXBlcyBhcmUgZGV0ZWN0YWJsZSB3aXRoaW4gdGhpcyByYW5nZS5cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbGVUeXBlRnJvbVN0cmVhbShzdHJlYW0pIHtcblx0cmV0dXJuIG5ldyBGaWxlVHlwZVBhcnNlcigpLmZyb21TdHJlYW0oc3RyZWFtKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbGVUeXBlRnJvbUJ1ZmZlcihpbnB1dCkge1xuXHRyZXR1cm4gbmV3IEZpbGVUeXBlUGFyc2VyKCkuZnJvbUJ1ZmZlcihpbnB1dCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmaWxlVHlwZUZyb21CbG9iKGJsb2IpIHtcblx0cmV0dXJuIG5ldyBGaWxlVHlwZVBhcnNlcigpLmZyb21CbG9iKGJsb2IpO1xufVxuXG5mdW5jdGlvbiBfY2hlY2soYnVmZmVyLCBoZWFkZXJzLCBvcHRpb25zKSB7XG5cdG9wdGlvbnMgPSB7XG5cdFx0b2Zmc2V0OiAwLFxuXHRcdC4uLm9wdGlvbnMsXG5cdH07XG5cblx0Zm9yIChjb25zdCBbaW5kZXgsIGhlYWRlcl0gb2YgaGVhZGVycy5lbnRyaWVzKCkpIHtcblx0XHQvLyBJZiBhIGJpdG1hc2sgaXMgc2V0XG5cdFx0aWYgKG9wdGlvbnMubWFzaykge1xuXHRcdFx0Ly8gSWYgaGVhZGVyIGRvZXNuJ3QgZXF1YWwgYGJ1ZmAgd2l0aCBiaXRzIG1hc2tlZCBvZmZcblx0XHRcdGlmIChoZWFkZXIgIT09IChvcHRpb25zLm1hc2tbaW5kZXhdICYgYnVmZmVyW2luZGV4ICsgb3B0aW9ucy5vZmZzZXRdKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChoZWFkZXIgIT09IGJ1ZmZlcltpbmRleCArIG9wdGlvbnMub2Zmc2V0XSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmlsZVR5cGVGcm9tVG9rZW5pemVyKHRva2VuaXplcikge1xuXHRyZXR1cm4gbmV3IEZpbGVUeXBlUGFyc2VyKCkuZnJvbVRva2VuaXplcih0b2tlbml6ZXIpO1xufVxuXG5leHBvcnQgY2xhc3MgRmlsZVR5cGVQYXJzZXIge1xuXHRjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG5cdFx0dGhpcy5kZXRlY3RvcnMgPSBvcHRpb25zPy5jdXN0b21EZXRlY3RvcnM7XG5cblx0XHR0aGlzLmZyb21Ub2tlbml6ZXIgPSB0aGlzLmZyb21Ub2tlbml6ZXIuYmluZCh0aGlzKTtcblx0XHR0aGlzLmZyb21CdWZmZXIgPSB0aGlzLmZyb21CdWZmZXIuYmluZCh0aGlzKTtcblx0XHR0aGlzLnBhcnNlID0gdGhpcy5wYXJzZS5iaW5kKHRoaXMpO1xuXHR9XG5cblx0YXN5bmMgZnJvbVRva2VuaXplcih0b2tlbml6ZXIpIHtcblx0XHRjb25zdCBpbml0aWFsUG9zaXRpb24gPSB0b2tlbml6ZXIucG9zaXRpb247XG5cblx0XHRmb3IgKGNvbnN0IGRldGVjdG9yIG9mIHRoaXMuZGV0ZWN0b3JzIHx8IFtdKSB7XG5cdFx0XHRjb25zdCBmaWxlVHlwZSA9IGF3YWl0IGRldGVjdG9yKHRva2VuaXplcik7XG5cdFx0XHRpZiAoZmlsZVR5cGUpIHtcblx0XHRcdFx0cmV0dXJuIGZpbGVUeXBlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaW5pdGlhbFBvc2l0aW9uICE9PSB0b2tlbml6ZXIucG9zaXRpb24pIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDsgLy8gQ2Fubm90IHByb2NlZWQgc2Nhbm5pbmcgb2YgdGhlIHRva2VuaXplciBpcyBhdCBhbiBhcmJpdHJhcnkgcG9zaXRpb25cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5wYXJzZSh0b2tlbml6ZXIpO1xuXHR9XG5cblx0YXN5bmMgZnJvbUJ1ZmZlcihpbnB1dCkge1xuXHRcdGlmICghKGlucHV0IGluc3RhbmNlb2YgVWludDhBcnJheSB8fCBpbnB1dCBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSkge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihgRXhwZWN0ZWQgdGhlIFxcYGlucHV0XFxgIGFyZ3VtZW50IHRvIGJlIG9mIHR5cGUgXFxgVWludDhBcnJheVxcYCBvciBcXGBCdWZmZXJcXGAgb3IgXFxgQXJyYXlCdWZmZXJcXGAsIGdvdCBcXGAke3R5cGVvZiBpbnB1dH1cXGBgKTtcblx0XHR9XG5cblx0XHRjb25zdCBidWZmZXIgPSBpbnB1dCBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkgPyBpbnB1dCA6IG5ldyBVaW50OEFycmF5KGlucHV0KTtcblxuXHRcdGlmICghKGJ1ZmZlcj8ubGVuZ3RoID4gMSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5mcm9tVG9rZW5pemVyKHN0cnRvazMuZnJvbUJ1ZmZlcihidWZmZXIpKTtcblx0fVxuXG5cdGFzeW5jIGZyb21CbG9iKGJsb2IpIHtcblx0XHRjb25zdCBidWZmZXIgPSBhd2FpdCBibG9iLmFycmF5QnVmZmVyKCk7XG5cdFx0cmV0dXJuIHRoaXMuZnJvbUJ1ZmZlcihuZXcgVWludDhBcnJheShidWZmZXIpKTtcblx0fVxuXG5cdGFzeW5jIGZyb21TdHJlYW0oc3RyZWFtKSB7XG5cdFx0Y29uc3QgdG9rZW5pemVyID0gYXdhaXQgc3RydG9rMy5mcm9tU3RyZWFtKHN0cmVhbSk7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBhd2FpdCB0aGlzLmZyb21Ub2tlbml6ZXIodG9rZW5pemVyKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YXdhaXQgdG9rZW5pemVyLmNsb3NlKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgdG9EZXRlY3Rpb25TdHJlYW0ocmVhZGFibGVTdHJlYW0sIG9wdGlvbnMgPSB7fSkge1xuXHRcdGNvbnN0IHtkZWZhdWx0OiBzdHJlYW19ID0gYXdhaXQgaW1wb3J0KCdub2RlOnN0cmVhbScpO1xuXHRcdGNvbnN0IHtzYW1wbGVTaXplID0gbWluaW11bUJ5dGVzfSA9IG9wdGlvbnM7XG5cblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0cmVhZGFibGVTdHJlYW0ub24oJ2Vycm9yJywgcmVqZWN0KTtcblxuXHRcdFx0cmVhZGFibGVTdHJlYW0ub25jZSgncmVhZGFibGUnLCAoKSA9PiB7XG5cdFx0XHRcdChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdC8vIFNldCB1cCBvdXRwdXQgc3RyZWFtXG5cdFx0XHRcdFx0XHRjb25zdCBwYXNzID0gbmV3IHN0cmVhbS5QYXNzVGhyb3VnaCgpO1xuXHRcdFx0XHRcdFx0Y29uc3Qgb3V0cHV0U3RyZWFtID0gc3RyZWFtLnBpcGVsaW5lID8gc3RyZWFtLnBpcGVsaW5lKHJlYWRhYmxlU3RyZWFtLCBwYXNzLCAoKSA9PiB7fSkgOiByZWFkYWJsZVN0cmVhbS5waXBlKHBhc3MpO1xuXG5cdFx0XHRcdFx0XHQvLyBSZWFkIHRoZSBpbnB1dCBzdHJlYW0gYW5kIGRldGVjdCB0aGUgZmlsZXR5cGVcblx0XHRcdFx0XHRcdGNvbnN0IGNodW5rID0gcmVhZGFibGVTdHJlYW0ucmVhZChzYW1wbGVTaXplKSA/PyByZWFkYWJsZVN0cmVhbS5yZWFkKCkgPz8gQnVmZmVyLmFsbG9jKDApO1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0cGFzcy5maWxlVHlwZSA9IGF3YWl0IHRoaXMuZnJvbUJ1ZmZlcihjaHVuayk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0XHRpZiAoZXJyb3IgaW5zdGFuY2VvZiBzdHJ0b2szLkVuZE9mU3RyZWFtRXJyb3IpIHtcblx0XHRcdFx0XHRcdFx0XHRwYXNzLmZpbGVUeXBlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdHJlamVjdChlcnJvcik7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0cmVzb2x2ZShvdXRwdXRTdHJlYW0pO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHRyZWplY3QoZXJyb3IpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkoKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0Y2hlY2soaGVhZGVyLCBvcHRpb25zKSB7XG5cdFx0cmV0dXJuIF9jaGVjayh0aGlzLmJ1ZmZlciwgaGVhZGVyLCBvcHRpb25zKTtcblx0fVxuXG5cdGNoZWNrU3RyaW5nKGhlYWRlciwgb3B0aW9ucykge1xuXHRcdHJldHVybiB0aGlzLmNoZWNrKHN0cmluZ1RvQnl0ZXMoaGVhZGVyKSwgb3B0aW9ucyk7XG5cdH1cblxuXHRhc3luYyBwYXJzZSh0b2tlbml6ZXIpIHtcblx0XHR0aGlzLmJ1ZmZlciA9IEJ1ZmZlci5hbGxvYyhtaW5pbXVtQnl0ZXMpO1xuXG5cdFx0Ly8gS2VlcCByZWFkaW5nIHVudGlsIEVPRiBpZiB0aGUgZmlsZSBzaXplIGlzIHVua25vd24uXG5cdFx0aWYgKHRva2VuaXplci5maWxlSW5mby5zaXplID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRva2VuaXplci5maWxlSW5mby5zaXplID0gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVI7XG5cdFx0fVxuXG5cdFx0dGhpcy50b2tlbml6ZXIgPSB0b2tlbml6ZXI7XG5cblx0XHRhd2FpdCB0b2tlbml6ZXIucGVla0J1ZmZlcih0aGlzLmJ1ZmZlciwge2xlbmd0aDogMTIsIG1heUJlTGVzczogdHJ1ZX0pO1xuXG5cdFx0Ly8gLS0gMi1ieXRlIHNpZ25hdHVyZXMgLS1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDQyLCAweDREXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2JtcCcsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS9ibXAnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgwQiwgMHg3N10pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdhYzMnLFxuXHRcdFx0XHRtaW1lOiAnYXVkaW8vdm5kLmRvbGJ5LmRkLXJhdycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDc4LCAweDAxXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2RtZycsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWFwcGxlLWRpc2tpbWFnZScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDRELCAweDVBXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2V4ZScsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LW1zZG93bmxvYWQnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgyNSwgMHgyMV0pKSB7XG5cdFx0XHRhd2FpdCB0b2tlbml6ZXIucGVla0J1ZmZlcih0aGlzLmJ1ZmZlciwge2xlbmd0aDogMjQsIG1heUJlTGVzczogdHJ1ZX0pO1xuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdHRoaXMuY2hlY2tTdHJpbmcoJ1BTLUFkb2JlLScsIHtvZmZzZXQ6IDJ9KVxuXHRcdFx0XHQmJiB0aGlzLmNoZWNrU3RyaW5nKCcgRVBTRi0nLCB7b2Zmc2V0OiAxNH0pXG5cdFx0XHQpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdlcHMnLFxuXHRcdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9lcHMnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdwcycsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9wb3N0c2NyaXB0Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5jaGVjayhbMHgxRiwgMHhBMF0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrKFsweDFGLCAweDlEXSlcblx0XHQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ1onLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1jb21wcmVzcycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweEM3LCAweDcxXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2NwaW8nLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1jcGlvJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NjAsIDB4RUFdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnYXJqJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtYXJqJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gLS0gMy1ieXRlIHNpZ25hdHVyZXMgLS1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweEVGLCAweEJCLCAweEJGXSkpIHsgLy8gVVRGLTgtQk9NXG5cdFx0XHQvLyBTdHJpcCBvZmYgVVRGLTgtQk9NXG5cdFx0XHR0aGlzLnRva2VuaXplci5pZ25vcmUoMyk7XG5cdFx0XHRyZXR1cm4gdGhpcy5wYXJzZSh0b2tlbml6ZXIpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDQ3LCAweDQ5LCAweDQ2XSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2dpZicsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS9naWYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0OSwgMHg0OSwgMHhCQ10pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdqeHInLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2Uvdm5kLm1zLXBob3RvJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MUYsIDB4OEIsIDB4OF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdneicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9nemlwJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NDIsIDB4NUEsIDB4NjhdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnYnoyJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtYnppcDInLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnSUQzJykpIHtcblx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUoNik7IC8vIFNraXAgSUQzIGhlYWRlciB1bnRpbCB0aGUgaGVhZGVyIHNpemVcblx0XHRcdGNvbnN0IGlkM0hlYWRlckxlbmd0aCA9IGF3YWl0IHRva2VuaXplci5yZWFkVG9rZW4odWludDMyU3luY1NhZmVUb2tlbik7XG5cdFx0XHRpZiAodG9rZW5pemVyLnBvc2l0aW9uICsgaWQzSGVhZGVyTGVuZ3RoID4gdG9rZW5pemVyLmZpbGVJbmZvLnNpemUpIHtcblx0XHRcdFx0Ly8gR3Vlc3MgZmlsZSB0eXBlIGJhc2VkIG9uIElEMyBoZWFkZXIgZm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHlcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdtcDMnLFxuXHRcdFx0XHRcdG1pbWU6ICdhdWRpby9tcGVnJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0YXdhaXQgdG9rZW5pemVyLmlnbm9yZShpZDNIZWFkZXJMZW5ndGgpO1xuXHRcdFx0cmV0dXJuIHRoaXMuZnJvbVRva2VuaXplcih0b2tlbml6ZXIpOyAvLyBTa2lwIElEMyBoZWFkZXIsIHJlY3Vyc2lvblxuXHRcdH1cblxuXHRcdC8vIE11c2VwYWNrLCBTVjdcblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnTVArJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ21wYycsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby94LW11c2VwYWNrJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0KHRoaXMuYnVmZmVyWzBdID09PSAweDQzIHx8IHRoaXMuYnVmZmVyWzBdID09PSAweDQ2KVxuXHRcdFx0JiYgdGhpcy5jaGVjayhbMHg1NywgMHg1M10sIHtvZmZzZXQ6IDF9KVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnc3dmJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gLS0gNC1ieXRlIHNpZ25hdHVyZXMgLS1cblxuXHRcdC8vIFJlcXVpcmVzIGEgc2FtcGxlIHNpemUgb2YgNCBieXRlc1xuXHRcdGlmICh0aGlzLmNoZWNrKFsweEZGLCAweEQ4LCAweEZGXSkpIHtcblx0XHRcdGlmICh0aGlzLmNoZWNrKFsweEY3XSwge29mZnNldDogM30pKSB7IC8vIEpQRzcvU09GNTUsIGluZGljYXRpbmcgYSBJU08vSUVDIDE0NDk1IC8gSlBFRy1MUyBmaWxlXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnamxzJyxcblx0XHRcdFx0XHRtaW1lOiAnaW1hZ2UvamxzJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnanBnJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL2pwZWcnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0RiwgMHg2MiwgMHg2QSwgMHgwMV0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdhdnJvJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL2F2cm8nLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnRkxJRicpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdmbGlmJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL2ZsaWYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnOEJQUycpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdwc2QnLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2Uvdm5kLmFkb2JlLnBob3Rvc2hvcCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdXRUJQJywge29mZnNldDogOH0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd3ZWJwJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL3dlYnAnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBNdXNlcGFjaywgU1Y4XG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ01QQ0snKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbXBjJyxcblx0XHRcdFx0bWltZTogJ2F1ZGlvL3gtbXVzZXBhY2snLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnRk9STScpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdhaWYnLFxuXHRcdFx0XHRtaW1lOiAnYXVkaW8vYWlmZicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdpY25zJywge29mZnNldDogMH0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdpY25zJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL2ljbnMnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBaaXAtYmFzZWQgZmlsZSBmb3JtYXRzXG5cdFx0Ly8gTmVlZCB0byBiZSBiZWZvcmUgdGhlIGB6aXBgIGNoZWNrXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NTAsIDB4NEIsIDB4MywgMHg0XSkpIHsgLy8gTG9jYWwgZmlsZSBoZWFkZXIgc2lnbmF0dXJlXG5cdFx0XHR0cnkge1xuXHRcdFx0XHR3aGlsZSAodG9rZW5pemVyLnBvc2l0aW9uICsgMzAgPCB0b2tlbml6ZXIuZmlsZUluZm8uc2l6ZSkge1xuXHRcdFx0XHRcdGF3YWl0IHRva2VuaXplci5yZWFkQnVmZmVyKHRoaXMuYnVmZmVyLCB7bGVuZ3RoOiAzMH0pO1xuXG5cdFx0XHRcdFx0Ly8gaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvWmlwXyhmaWxlX2Zvcm1hdCkjRmlsZV9oZWFkZXJzXG5cdFx0XHRcdFx0Y29uc3QgemlwSGVhZGVyID0ge1xuXHRcdFx0XHRcdFx0Y29tcHJlc3NlZFNpemU6IHRoaXMuYnVmZmVyLnJlYWRVSW50MzJMRSgxOCksXG5cdFx0XHRcdFx0XHR1bmNvbXByZXNzZWRTaXplOiB0aGlzLmJ1ZmZlci5yZWFkVUludDMyTEUoMjIpLFxuXHRcdFx0XHRcdFx0ZmlsZW5hbWVMZW5ndGg6IHRoaXMuYnVmZmVyLnJlYWRVSW50MTZMRSgyNiksXG5cdFx0XHRcdFx0XHRleHRyYUZpZWxkTGVuZ3RoOiB0aGlzLmJ1ZmZlci5yZWFkVUludDE2TEUoMjgpLFxuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHR6aXBIZWFkZXIuZmlsZW5hbWUgPSBhd2FpdCB0b2tlbml6ZXIucmVhZFRva2VuKG5ldyBUb2tlbi5TdHJpbmdUeXBlKHppcEhlYWRlci5maWxlbmFtZUxlbmd0aCwgJ3V0Zi04JykpO1xuXHRcdFx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUoemlwSGVhZGVyLmV4dHJhRmllbGRMZW5ndGgpO1xuXG5cdFx0XHRcdFx0Ly8gQXNzdW1lcyBzaWduZWQgYC54cGlgIGZyb20gYWRkb25zLm1vemlsbGEub3JnXG5cdFx0XHRcdFx0aWYgKHppcEhlYWRlci5maWxlbmFtZSA9PT0gJ01FVEEtSU5GL21vemlsbGEucnNhJykge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0ZXh0OiAneHBpJyxcblx0XHRcdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gteHBpbnN0YWxsJyxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHppcEhlYWRlci5maWxlbmFtZS5lbmRzV2l0aCgnLnJlbHMnKSB8fCB6aXBIZWFkZXIuZmlsZW5hbWUuZW5kc1dpdGgoJy54bWwnKSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgdHlwZSA9IHppcEhlYWRlci5maWxlbmFtZS5zcGxpdCgnLycpWzBdO1xuXHRcdFx0XHRcdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRcdFx0XHRcdGNhc2UgJ19yZWxzJzpcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0Y2FzZSAnd29yZCc6XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0XHRcdGV4dDogJ2RvY3gnLFxuXHRcdFx0XHRcdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC53b3JkcHJvY2Vzc2luZ21sLmRvY3VtZW50Jyxcblx0XHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHRjYXNlICdwcHQnOlxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRleHQ6ICdwcHR4Jyxcblx0XHRcdFx0XHRcdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQucHJlc2VudGF0aW9ubWwucHJlc2VudGF0aW9uJyxcblx0XHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHRjYXNlICd4bCc6XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0XHRcdGV4dDogJ3hsc3gnLFxuXHRcdFx0XHRcdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC5zcHJlYWRzaGVldG1sLnNoZWV0Jyxcblx0XHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICh6aXBIZWFkZXIuZmlsZW5hbWUuc3RhcnRzV2l0aCgneGwvJykpIHtcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdGV4dDogJ3hsc3gnLFxuXHRcdFx0XHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LnNwcmVhZHNoZWV0bWwuc2hlZXQnLFxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoemlwSGVhZGVyLmZpbGVuYW1lLnN0YXJ0c1dpdGgoJzNELycpICYmIHppcEhlYWRlci5maWxlbmFtZS5lbmRzV2l0aCgnLm1vZGVsJykpIHtcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdGV4dDogJzNtZicsXG5cdFx0XHRcdFx0XHRcdG1pbWU6ICdtb2RlbC8zbWYnLFxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBUaGUgZG9jeCwgeGxzeCBhbmQgcHB0eCBmaWxlIHR5cGVzIGV4dGVuZCB0aGUgT2ZmaWNlIE9wZW4gWE1MIGZpbGUgZm9ybWF0OlxuXHRcdFx0XHRcdC8vIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL09mZmljZV9PcGVuX1hNTF9maWxlX2Zvcm1hdHNcblx0XHRcdFx0XHQvLyBXZSBsb29rIGZvcjpcblx0XHRcdFx0XHQvLyAtIG9uZSBlbnRyeSBuYW1lZCAnW0NvbnRlbnRfVHlwZXNdLnhtbCcgb3IgJ19yZWxzLy5yZWxzJyxcblx0XHRcdFx0XHQvLyAtIG9uZSBlbnRyeSBpbmRpY2F0aW5nIHNwZWNpZmljIHR5cGUgb2YgZmlsZS5cblx0XHRcdFx0XHQvLyBNUyBPZmZpY2UsIE9wZW5PZmZpY2UgYW5kIExpYnJlT2ZmaWNlIG1heSBwdXQgdGhlIHBhcnRzIGluIGRpZmZlcmVudCBvcmRlciwgc28gdGhlIGNoZWNrIHNob3VsZCBub3QgcmVseSBvbiBpdC5cblx0XHRcdFx0XHRpZiAoemlwSGVhZGVyLmZpbGVuYW1lID09PSAnbWltZXR5cGUnICYmIHppcEhlYWRlci5jb21wcmVzc2VkU2l6ZSA9PT0gemlwSGVhZGVyLnVuY29tcHJlc3NlZFNpemUpIHtcblx0XHRcdFx0XHRcdGxldCBtaW1lVHlwZSA9IGF3YWl0IHRva2VuaXplci5yZWFkVG9rZW4obmV3IFRva2VuLlN0cmluZ1R5cGUoemlwSGVhZGVyLmNvbXByZXNzZWRTaXplLCAndXRmLTgnKSk7XG5cdFx0XHRcdFx0XHRtaW1lVHlwZSA9IG1pbWVUeXBlLnRyaW0oKTtcblxuXHRcdFx0XHRcdFx0c3dpdGNoIChtaW1lVHlwZSkge1xuXHRcdFx0XHRcdFx0XHRjYXNlICdhcHBsaWNhdGlvbi9lcHViK3ppcCc6XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0XHRcdGV4dDogJ2VwdWInLFxuXHRcdFx0XHRcdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL2VwdWIremlwJyxcblx0XHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHRjYXNlICdhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LnRleHQnOlxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRleHQ6ICdvZHQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQudGV4dCcsXG5cdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0Y2FzZSAnYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC5zcHJlYWRzaGVldCc6XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0XHRcdGV4dDogJ29kcycsXG5cdFx0XHRcdFx0XHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC5zcHJlYWRzaGVldCcsXG5cdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0Y2FzZSAnYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC5wcmVzZW50YXRpb24nOlxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRleHQ6ICdvZHAnLFxuXHRcdFx0XHRcdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQucHJlc2VudGF0aW9uJyxcblx0XHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIFRyeSB0byBmaW5kIG5leHQgaGVhZGVyIG1hbnVhbGx5IHdoZW4gY3VycmVudCBvbmUgaXMgY29ycnVwdGVkXG5cdFx0XHRcdFx0aWYgKHppcEhlYWRlci5jb21wcmVzc2VkU2l6ZSA9PT0gMCkge1xuXHRcdFx0XHRcdFx0bGV0IG5leHRIZWFkZXJJbmRleCA9IC0xO1xuXG5cdFx0XHRcdFx0XHR3aGlsZSAobmV4dEhlYWRlckluZGV4IDwgMCAmJiAodG9rZW5pemVyLnBvc2l0aW9uIDwgdG9rZW5pemVyLmZpbGVJbmZvLnNpemUpKSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRva2VuaXplci5wZWVrQnVmZmVyKHRoaXMuYnVmZmVyLCB7bWF5QmVMZXNzOiB0cnVlfSk7XG5cblx0XHRcdFx0XHRcdFx0bmV4dEhlYWRlckluZGV4ID0gdGhpcy5idWZmZXIuaW5kZXhPZignNTA0QjAzMDQnLCAwLCAnaGV4Jyk7XG5cdFx0XHRcdFx0XHRcdC8vIE1vdmUgcG9zaXRpb24gdG8gdGhlIG5leHQgaGVhZGVyIGlmIGZvdW5kLCBza2lwIHRoZSB3aG9sZSBidWZmZXIgb3RoZXJ3aXNlXG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUobmV4dEhlYWRlckluZGV4ID49IDAgPyBuZXh0SGVhZGVySW5kZXggOiB0aGlzLmJ1ZmZlci5sZW5ndGgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0b2tlbml6ZXIuaWdub3JlKHppcEhlYWRlci5jb21wcmVzc2VkU2l6ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRpZiAoIShlcnJvciBpbnN0YW5jZW9mIHN0cnRvazMuRW5kT2ZTdHJlYW1FcnJvcikpIHtcblx0XHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd6aXAnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vemlwJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ09nZ1MnKSkge1xuXHRcdFx0Ly8gVGhpcyBpcyBhbiBPR0cgY29udGFpbmVyXG5cdFx0XHRhd2FpdCB0b2tlbml6ZXIuaWdub3JlKDI4KTtcblx0XHRcdGNvbnN0IHR5cGUgPSBCdWZmZXIuYWxsb2MoOCk7XG5cdFx0XHRhd2FpdCB0b2tlbml6ZXIucmVhZEJ1ZmZlcih0eXBlKTtcblxuXHRcdFx0Ly8gTmVlZHMgdG8gYmUgYmVmb3JlIGBvZ2dgIGNoZWNrXG5cdFx0XHRpZiAoX2NoZWNrKHR5cGUsIFsweDRGLCAweDcwLCAweDc1LCAweDczLCAweDQ4LCAweDY1LCAweDYxLCAweDY0XSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdvcHVzJyxcblx0XHRcdFx0XHRtaW1lOiAnYXVkaW8vb3B1cycsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmICcgdGhlb3JhJyBpbiBoZWFkZXIuXG5cdFx0XHRpZiAoX2NoZWNrKHR5cGUsIFsweDgwLCAweDc0LCAweDY4LCAweDY1LCAweDZGLCAweDcyLCAweDYxXSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdvZ3YnLFxuXHRcdFx0XHRcdG1pbWU6ICd2aWRlby9vZ2cnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBJZiAnXFx4MDF2aWRlbycgaW4gaGVhZGVyLlxuXHRcdFx0aWYgKF9jaGVjayh0eXBlLCBbMHgwMSwgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSwgMHg2RiwgMHgwMF0pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnb2dtJyxcblx0XHRcdFx0XHRtaW1lOiAndmlkZW8vb2dnJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgJyBGTEFDJyBpbiBoZWFkZXIgIGh0dHBzOi8veGlwaC5vcmcvZmxhYy9mYXEuaHRtbFxuXHRcdFx0aWYgKF9jaGVjayh0eXBlLCBbMHg3RiwgMHg0NiwgMHg0QywgMHg0MSwgMHg0M10pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnb2dhJyxcblx0XHRcdFx0XHRtaW1lOiAnYXVkaW8vb2dnJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gJ1NwZWV4ICAnIGluIGhlYWRlciBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9TcGVleFxuXHRcdFx0aWYgKF9jaGVjayh0eXBlLCBbMHg1MywgMHg3MCwgMHg2NSwgMHg2NSwgMHg3OCwgMHgyMCwgMHgyMF0pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnc3B4Jyxcblx0XHRcdFx0XHRtaW1lOiAnYXVkaW8vb2dnJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgJ1xceDAxdm9yYmlzJyBpbiBoZWFkZXJcblx0XHRcdGlmIChfY2hlY2sodHlwZSwgWzB4MDEsIDB4NzYsIDB4NkYsIDB4NzIsIDB4NjIsIDB4NjksIDB4NzNdKSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ29nZycsXG5cdFx0XHRcdFx0bWltZTogJ2F1ZGlvL29nZycsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdC8vIERlZmF1bHQgT0dHIGNvbnRhaW5lciBodHRwczovL3d3dy5pYW5hLm9yZy9hc3NpZ25tZW50cy9tZWRpYS10eXBlcy9hcHBsaWNhdGlvbi9vZ2dcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ29neCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9vZ2cnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoXG5cdFx0XHR0aGlzLmNoZWNrKFsweDUwLCAweDRCXSlcblx0XHRcdCYmICh0aGlzLmJ1ZmZlclsyXSA9PT0gMHgzIHx8IHRoaXMuYnVmZmVyWzJdID09PSAweDUgfHwgdGhpcy5idWZmZXJbMl0gPT09IDB4Nylcblx0XHRcdCYmICh0aGlzLmJ1ZmZlclszXSA9PT0gMHg0IHx8IHRoaXMuYnVmZmVyWzNdID09PSAweDYgfHwgdGhpcy5idWZmZXJbM10gPT09IDB4OClcblx0XHQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3ppcCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi96aXAnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvL1xuXG5cdFx0Ly8gRmlsZSBUeXBlIEJveCAoaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSVNPX2Jhc2VfbWVkaWFfZmlsZV9mb3JtYXQpXG5cdFx0Ly8gSXQncyBub3QgcmVxdWlyZWQgdG8gYmUgZmlyc3QsIGJ1dCBpdCdzIHJlY29tbWVuZGVkIHRvIGJlLiBBbG1vc3QgYWxsIElTTyBiYXNlIG1lZGlhIGZpbGVzIHN0YXJ0IHdpdGggYGZ0eXBgIGJveC5cblx0XHQvLyBgZnR5cGAgYm94IG11c3QgY29udGFpbiBhIGJyYW5kIG1ham9yIGlkZW50aWZpZXIsIHdoaWNoIG11c3QgY29uc2lzdCBvZiBJU08gODg1OS0xIHByaW50YWJsZSBjaGFyYWN0ZXJzLlxuXHRcdC8vIEhlcmUgd2UgY2hlY2sgZm9yIDg4NTktMSBwcmludGFibGUgY2hhcmFjdGVycyAoZm9yIHNpbXBsaWNpdHksIGl0J3MgYSBtYXNrIHdoaWNoIGFsc28gY2F0Y2hlcyBvbmUgbm9uLXByaW50YWJsZSBjaGFyYWN0ZXIpLlxuXHRcdGlmIChcblx0XHRcdHRoaXMuY2hlY2tTdHJpbmcoJ2Z0eXAnLCB7b2Zmc2V0OiA0fSlcblx0XHRcdCYmICh0aGlzLmJ1ZmZlcls4XSAmIDB4NjApICE9PSAweDAwIC8vIEJyYW5kIG1ham9yLCBmaXJzdCBjaGFyYWN0ZXIgQVNDSUk/XG5cdFx0KSB7XG5cdFx0XHQvLyBUaGV5IGFsbCBjYW4gaGF2ZSBNSU1FIGB2aWRlby9tcDRgIGV4Y2VwdCBgYXBwbGljYXRpb24vbXA0YCBzcGVjaWFsLWNhc2Ugd2hpY2ggaXMgaGFyZCB0byBkZXRlY3QuXG5cdFx0XHQvLyBGb3Igc29tZSBjYXNlcywgd2UncmUgc3BlY2lmaWMsIGV2ZXJ5dGhpbmcgZWxzZSBmYWxscyB0byBgdmlkZW8vbXA0YCB3aXRoIGBtcDRgIGV4dGVuc2lvbi5cblx0XHRcdGNvbnN0IGJyYW5kTWFqb3IgPSB0aGlzLmJ1ZmZlci50b1N0cmluZygnYmluYXJ5JywgOCwgMTIpLnJlcGxhY2UoJ1xcMCcsICcgJykudHJpbSgpO1xuXHRcdFx0c3dpdGNoIChicmFuZE1ham9yKSB7XG5cdFx0XHRcdGNhc2UgJ2F2aWYnOlxuXHRcdFx0XHRjYXNlICdhdmlzJzpcblx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJ2F2aWYnLCBtaW1lOiAnaW1hZ2UvYXZpZid9O1xuXHRcdFx0XHRjYXNlICdtaWYxJzpcblx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJ2hlaWMnLCBtaW1lOiAnaW1hZ2UvaGVpZid9O1xuXHRcdFx0XHRjYXNlICdtc2YxJzpcblx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJ2hlaWMnLCBtaW1lOiAnaW1hZ2UvaGVpZi1zZXF1ZW5jZSd9O1xuXHRcdFx0XHRjYXNlICdoZWljJzpcblx0XHRcdFx0Y2FzZSAnaGVpeCc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdoZWljJywgbWltZTogJ2ltYWdlL2hlaWMnfTtcblx0XHRcdFx0Y2FzZSAnaGV2Yyc6XG5cdFx0XHRcdGNhc2UgJ2hldngnOlxuXHRcdFx0XHRcdHJldHVybiB7ZXh0OiAnaGVpYycsIG1pbWU6ICdpbWFnZS9oZWljLXNlcXVlbmNlJ307XG5cdFx0XHRcdGNhc2UgJ3F0Jzpcblx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJ21vdicsIG1pbWU6ICd2aWRlby9xdWlja3RpbWUnfTtcblx0XHRcdFx0Y2FzZSAnTTRWJzpcblx0XHRcdFx0Y2FzZSAnTTRWSCc6XG5cdFx0XHRcdGNhc2UgJ000VlAnOlxuXHRcdFx0XHRcdHJldHVybiB7ZXh0OiAnbTR2JywgbWltZTogJ3ZpZGVvL3gtbTR2J307XG5cdFx0XHRcdGNhc2UgJ000UCc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdtNHAnLCBtaW1lOiAndmlkZW8vbXA0J307XG5cdFx0XHRcdGNhc2UgJ000Qic6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdtNGInLCBtaW1lOiAnYXVkaW8vbXA0J307XG5cdFx0XHRcdGNhc2UgJ000QSc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdtNGEnLCBtaW1lOiAnYXVkaW8veC1tNGEnfTtcblx0XHRcdFx0Y2FzZSAnRjRWJzpcblx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJ2Y0dicsIG1pbWU6ICd2aWRlby9tcDQnfTtcblx0XHRcdFx0Y2FzZSAnRjRQJzpcblx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJ2Y0cCcsIG1pbWU6ICd2aWRlby9tcDQnfTtcblx0XHRcdFx0Y2FzZSAnRjRBJzpcblx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJ2Y0YScsIG1pbWU6ICdhdWRpby9tcDQnfTtcblx0XHRcdFx0Y2FzZSAnRjRCJzpcblx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJ2Y0YicsIG1pbWU6ICdhdWRpby9tcDQnfTtcblx0XHRcdFx0Y2FzZSAnY3J4Jzpcblx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJ2NyMycsIG1pbWU6ICdpbWFnZS94LWNhbm9uLWNyMyd9O1xuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdGlmIChicmFuZE1ham9yLnN0YXJ0c1dpdGgoJzNnJykpIHtcblx0XHRcdFx0XHRcdGlmIChicmFuZE1ham9yLnN0YXJ0c1dpdGgoJzNnMicpKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB7ZXh0OiAnM2cyJywgbWltZTogJ3ZpZGVvLzNncHAyJ307XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHJldHVybiB7ZXh0OiAnM2dwJywgbWltZTogJ3ZpZGVvLzNncHAnfTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJ21wNCcsIG1pbWU6ICd2aWRlby9tcDQnfTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnTVRoZCcpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdtaWQnLFxuXHRcdFx0XHRtaW1lOiAnYXVkaW8vbWlkaScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdHRoaXMuY2hlY2tTdHJpbmcoJ3dPRkYnKVxuXHRcdFx0JiYgKFxuXHRcdFx0XHR0aGlzLmNoZWNrKFsweDAwLCAweDAxLCAweDAwLCAweDAwXSwge29mZnNldDogNH0pXG5cdFx0XHRcdHx8IHRoaXMuY2hlY2tTdHJpbmcoJ09UVE8nLCB7b2Zmc2V0OiA0fSlcblx0XHRcdClcblx0XHQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3dvZmYnLFxuXHRcdFx0XHRtaW1lOiAnZm9udC93b2ZmJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5jaGVja1N0cmluZygnd09GMicpXG5cdFx0XHQmJiAoXG5cdFx0XHRcdHRoaXMuY2hlY2soWzB4MDAsIDB4MDEsIDB4MDAsIDB4MDBdLCB7b2Zmc2V0OiA0fSlcblx0XHRcdFx0fHwgdGhpcy5jaGVja1N0cmluZygnT1RUTycsIHtvZmZzZXQ6IDR9KVxuXHRcdFx0KVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnd29mZjInLFxuXHRcdFx0XHRtaW1lOiAnZm9udC93b2ZmMicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweEQ0LCAweEMzLCAweEIyLCAweEExXSkgfHwgdGhpcy5jaGVjayhbMHhBMSwgMHhCMiwgMHhDMywgMHhENF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdwY2FwJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC50Y3BkdW1wLnBjYXAnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBTb255IERTRCBTdHJlYW0gRmlsZSAoRFNGKVxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdEU0QgJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2RzZicsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby94LWRzZicsIC8vIE5vbi1zdGFuZGFyZFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnTFpJUCcpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdseicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWx6aXAnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnZkxhQycpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdmbGFjJyxcblx0XHRcdFx0bWltZTogJ2F1ZGlvL3gtZmxhYycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDQyLCAweDUwLCAweDQ3LCAweEZCXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2JwZycsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS9icGcnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnd3ZwaycpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd3dicsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby93YXZwYWNrJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJyVQREYnKSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdG9rZW5pemVyLmlnbm9yZSgxMzUwKTtcblx0XHRcdFx0Y29uc3QgbWF4QnVmZmVyU2l6ZSA9IDEwICogMTAyNCAqIDEwMjQ7XG5cdFx0XHRcdGNvbnN0IGJ1ZmZlciA9IEJ1ZmZlci5hbGxvYyhNYXRoLm1pbihtYXhCdWZmZXJTaXplLCB0b2tlbml6ZXIuZmlsZUluZm8uc2l6ZSkpO1xuXHRcdFx0XHRhd2FpdCB0b2tlbml6ZXIucmVhZEJ1ZmZlcihidWZmZXIsIHttYXlCZUxlc3M6IHRydWV9KTtcblxuXHRcdFx0XHQvLyBDaGVjayBpZiB0aGlzIGlzIGFuIEFkb2JlIElsbHVzdHJhdG9yIGZpbGVcblx0XHRcdFx0aWYgKGJ1ZmZlci5pbmNsdWRlcyhCdWZmZXIuZnJvbSgnQUlQcml2YXRlRGF0YScpKSkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRleHQ6ICdhaScsXG5cdFx0XHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vcG9zdHNjcmlwdCcsXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0Ly8gU3dhbGxvdyBlbmQgb2Ygc3RyZWFtIGVycm9yIGlmIGZpbGUgaXMgdG9vIHNtYWxsIGZvciB0aGUgQWRvYmUgQUkgY2hlY2tcblx0XHRcdFx0aWYgKCEoZXJyb3IgaW5zdGFuY2VvZiBzdHJ0b2szLkVuZE9mU3RyZWFtRXJyb3IpKSB7XG5cdFx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gQXNzdW1lIHRoaXMgaXMganVzdCBhIG5vcm1hbCBQREZcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3BkZicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9wZGYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgwMCwgMHg2MSwgMHg3MywgMHg2RF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd3YXNtJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3dhc20nLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBUSUZGLCBsaXR0bGUtZW5kaWFuIHR5cGVcblx0XHRpZiAodGhpcy5jaGVjayhbMHg0OSwgMHg0OV0pKSB7XG5cdFx0XHRjb25zdCBmaWxlVHlwZSA9IGF3YWl0IHRoaXMucmVhZFRpZmZIZWFkZXIoZmFsc2UpO1xuXHRcdFx0aWYgKGZpbGVUeXBlKSB7XG5cdFx0XHRcdHJldHVybiBmaWxlVHlwZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBUSUZGLCBiaWctZW5kaWFuIHR5cGVcblx0XHRpZiAodGhpcy5jaGVjayhbMHg0RCwgMHg0RF0pKSB7XG5cdFx0XHRjb25zdCBmaWxlVHlwZSA9IGF3YWl0IHRoaXMucmVhZFRpZmZIZWFkZXIodHJ1ZSk7XG5cdFx0XHRpZiAoZmlsZVR5cGUpIHtcblx0XHRcdFx0cmV0dXJuIGZpbGVUeXBlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdNQUMgJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2FwZScsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby9hcGUnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vZmlsZS9maWxlL2Jsb2IvbWFzdGVyL21hZ2ljL01hZ2Rpci9tYXRyb3NrYVxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDFBLCAweDQ1LCAweERGLCAweEEzXSkpIHsgLy8gUm9vdCBlbGVtZW50OiBFQk1MXG5cdFx0XHRhc3luYyBmdW5jdGlvbiByZWFkRmllbGQoKSB7XG5cdFx0XHRcdGNvbnN0IG1zYiA9IGF3YWl0IHRva2VuaXplci5wZWVrTnVtYmVyKFRva2VuLlVJTlQ4KTtcblx0XHRcdFx0bGV0IG1hc2sgPSAweDgwO1xuXHRcdFx0XHRsZXQgaWMgPSAwOyAvLyAwID0gQSwgMSA9IEIsIDIgPSBDLCAzXG5cdFx0XHRcdC8vID0gRFxuXG5cdFx0XHRcdHdoaWxlICgobXNiICYgbWFzaykgPT09IDAgJiYgbWFzayAhPT0gMCkge1xuXHRcdFx0XHRcdCsraWM7XG5cdFx0XHRcdFx0bWFzayA+Pj0gMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGlkID0gQnVmZmVyLmFsbG9jKGljICsgMSk7XG5cdFx0XHRcdGF3YWl0IHRva2VuaXplci5yZWFkQnVmZmVyKGlkKTtcblx0XHRcdFx0cmV0dXJuIGlkO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3luYyBmdW5jdGlvbiByZWFkRWxlbWVudCgpIHtcblx0XHRcdFx0Y29uc3QgaWQgPSBhd2FpdCByZWFkRmllbGQoKTtcblx0XHRcdFx0Y29uc3QgbGVuZ3RoRmllbGQgPSBhd2FpdCByZWFkRmllbGQoKTtcblx0XHRcdFx0bGVuZ3RoRmllbGRbMF0gXj0gMHg4MCA+PiAobGVuZ3RoRmllbGQubGVuZ3RoIC0gMSk7XG5cdFx0XHRcdGNvbnN0IG5yTGVuZ3RoID0gTWF0aC5taW4oNiwgbGVuZ3RoRmllbGQubGVuZ3RoKTsgLy8gSmF2YVNjcmlwdCBjYW4gbWF4IHJlYWQgNiBieXRlcyBpbnRlZ2VyXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aWQ6IGlkLnJlYWRVSW50QkUoMCwgaWQubGVuZ3RoKSxcblx0XHRcdFx0XHRsZW46IGxlbmd0aEZpZWxkLnJlYWRVSW50QkUobGVuZ3RoRmllbGQubGVuZ3RoIC0gbnJMZW5ndGgsIG5yTGVuZ3RoKSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0YXN5bmMgZnVuY3Rpb24gcmVhZENoaWxkcmVuKGNoaWxkcmVuKSB7XG5cdFx0XHRcdHdoaWxlIChjaGlsZHJlbiA+IDApIHtcblx0XHRcdFx0XHRjb25zdCBlbGVtZW50ID0gYXdhaXQgcmVhZEVsZW1lbnQoKTtcblx0XHRcdFx0XHRpZiAoZWxlbWVudC5pZCA9PT0gMHg0Ml84Mikge1xuXHRcdFx0XHRcdFx0Y29uc3QgcmF3VmFsdWUgPSBhd2FpdCB0b2tlbml6ZXIucmVhZFRva2VuKG5ldyBUb2tlbi5TdHJpbmdUeXBlKGVsZW1lbnQubGVuLCAndXRmLTgnKSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcmF3VmFsdWUucmVwbGFjZSgvXFwwMC4qJC9nLCAnJyk7IC8vIFJldHVybiBEb2NUeXBlXG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0YXdhaXQgdG9rZW5pemVyLmlnbm9yZShlbGVtZW50Lmxlbik7IC8vIGlnbm9yZSBwYXlsb2FkXG5cdFx0XHRcdFx0LS1jaGlsZHJlbjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZSA9IGF3YWl0IHJlYWRFbGVtZW50KCk7XG5cdFx0XHRjb25zdCBkb2NUeXBlID0gYXdhaXQgcmVhZENoaWxkcmVuKHJlLmxlbik7XG5cblx0XHRcdHN3aXRjaCAoZG9jVHlwZSkge1xuXHRcdFx0XHRjYXNlICd3ZWJtJzpcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZXh0OiAnd2VibScsXG5cdFx0XHRcdFx0XHRtaW1lOiAndmlkZW8vd2VibScsXG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRjYXNlICdtYXRyb3NrYSc6XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGV4dDogJ21rdicsXG5cdFx0XHRcdFx0XHRtaW1lOiAndmlkZW8veC1tYXRyb3NrYScsXG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBSSUZGIGZpbGUgZm9ybWF0IHdoaWNoIG1pZ2h0IGJlIEFWSSwgV0FWLCBRQ1AsIGV0Y1xuXHRcdGlmICh0aGlzLmNoZWNrKFsweDUyLCAweDQ5LCAweDQ2LCAweDQ2XSkpIHtcblx0XHRcdGlmICh0aGlzLmNoZWNrKFsweDQxLCAweDU2LCAweDQ5XSwge29mZnNldDogOH0pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnYXZpJyxcblx0XHRcdFx0XHRtaW1lOiAndmlkZW8vdm5kLmF2aScsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmNoZWNrKFsweDU3LCAweDQxLCAweDU2LCAweDQ1XSwge29mZnNldDogOH0pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnd2F2Jyxcblx0XHRcdFx0XHRtaW1lOiAnYXVkaW8vdm5kLndhdmUnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBRTENNLCBRQ1AgZmlsZVxuXHRcdFx0aWYgKHRoaXMuY2hlY2soWzB4NTEsIDB4NEMsIDB4NDMsIDB4NERdLCB7b2Zmc2V0OiA4fSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdxY3AnLFxuXHRcdFx0XHRcdG1pbWU6ICdhdWRpby9xY2VscCcsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ1NRTGknKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnc3FsaXRlJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtc3FsaXRlMycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDRFLCAweDQ1LCAweDUzLCAweDFBXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ25lcycsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LW5pbnRlbmRvLW5lcy1yb20nLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnQ3IyNCcpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdjcngnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1nb29nbGUtY2hyb21lLWV4dGVuc2lvbicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdHRoaXMuY2hlY2tTdHJpbmcoJ01TQ0YnKVxuXHRcdFx0fHwgdGhpcy5jaGVja1N0cmluZygnSVNjKCcpXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdjYWInLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vdm5kLm1zLWNhYi1jb21wcmVzc2VkJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4RUQsIDB4QUIsIDB4RUUsIDB4REJdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAncnBtJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtcnBtJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4QzUsIDB4RDAsIDB4RDMsIDB4QzZdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZXBzJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL2VwcycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDI4LCAweEI1LCAweDJGLCAweEZEXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3pzdCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi96c3RkJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4N0YsIDB4NDUsIDB4NEMsIDB4NDZdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZWxmJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtZWxmJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MjEsIDB4NDIsIDB4NDQsIDB4NEVdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAncHN0Jyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5tcy1vdXRsb29rJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ1BBUjEnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAncGFycXVldCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LXBhcnF1ZXQnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhDRiwgMHhGQSwgMHhFRCwgMHhGRV0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdtYWNobycsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LW1hY2gtYmluYXJ5Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gLS0gNS1ieXRlIHNpZ25hdHVyZXMgLS1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDRGLCAweDU0LCAweDU0LCAweDRGLCAweDAwXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ290ZicsXG5cdFx0XHRcdG1pbWU6ICdmb250L290ZicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCcjIUFNUicpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdhbXInLFxuXHRcdFx0XHRtaW1lOiAnYXVkaW8vYW1yJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ3tcXFxccnRmJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3J0ZicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9ydGYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0NiwgMHg0QywgMHg1NiwgMHgwMV0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdmbHYnLFxuXHRcdFx0XHRtaW1lOiAndmlkZW8veC1mbHYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnSU1QTScpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdpdCcsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby94LWl0Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5jaGVja1N0cmluZygnLWxoMC0nLCB7b2Zmc2V0OiAyfSlcblx0XHRcdHx8IHRoaXMuY2hlY2tTdHJpbmcoJy1saDEtJywge29mZnNldDogMn0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrU3RyaW5nKCctbGgyLScsIHtvZmZzZXQ6IDJ9KVxuXHRcdFx0fHwgdGhpcy5jaGVja1N0cmluZygnLWxoMy0nLCB7b2Zmc2V0OiAyfSlcblx0XHRcdHx8IHRoaXMuY2hlY2tTdHJpbmcoJy1saDQtJywge29mZnNldDogMn0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrU3RyaW5nKCctbGg1LScsIHtvZmZzZXQ6IDJ9KVxuXHRcdFx0fHwgdGhpcy5jaGVja1N0cmluZygnLWxoNi0nLCB7b2Zmc2V0OiAyfSlcblx0XHRcdHx8IHRoaXMuY2hlY2tTdHJpbmcoJy1saDctJywge29mZnNldDogMn0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrU3RyaW5nKCctbHpzLScsIHtvZmZzZXQ6IDJ9KVxuXHRcdFx0fHwgdGhpcy5jaGVja1N0cmluZygnLWx6NC0nLCB7b2Zmc2V0OiAyfSlcblx0XHRcdHx8IHRoaXMuY2hlY2tTdHJpbmcoJy1sejUtJywge29mZnNldDogMn0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrU3RyaW5nKCctbGhkLScsIHtvZmZzZXQ6IDJ9KVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbHpoJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtbHpoLWNvbXByZXNzZWQnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBNUEVHIHByb2dyYW0gc3RyZWFtIChQUyBvciBNUEVHLVBTKVxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDAwLCAweDAwLCAweDAxLCAweEJBXSkpIHtcblx0XHRcdC8vICBNUEVHLVBTLCBNUEVHLTEgUGFydCAxXG5cdFx0XHRpZiAodGhpcy5jaGVjayhbMHgyMV0sIHtvZmZzZXQ6IDQsIG1hc2s6IFsweEYxXX0pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnbXBnJywgLy8gTWF5IGFsc28gYmUgLnBzLCAubXBlZ1xuXHRcdFx0XHRcdG1pbWU6ICd2aWRlby9NUDFTJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gTVBFRy1QUywgTVBFRy0yIFBhcnQgMVxuXHRcdFx0aWYgKHRoaXMuY2hlY2soWzB4NDRdLCB7b2Zmc2V0OiA0LCBtYXNrOiBbMHhDNF19KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ21wZycsIC8vIE1heSBhbHNvIGJlIC5tcGcsIC5tMnAsIC52b2Igb3IgLnN1YlxuXHRcdFx0XHRcdG1pbWU6ICd2aWRlby9NUDJQJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnSVRTRicpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdjaG0nLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vdm5kLm1zLWh0bWxoZWxwJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4Q0EsIDB4RkUsIDB4QkEsIDB4QkVdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnY2xhc3MnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vamF2YS12bScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIC0tIDYtYnl0ZSBzaWduYXR1cmVzIC0tXG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhGRCwgMHgzNywgMHg3QSwgMHg1OCwgMHg1QSwgMHgwMF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd4eicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LXh6Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJzw/eG1sICcpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd4bWwnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veG1sJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MzcsIDB4N0EsIDB4QkMsIDB4QUYsIDB4MjcsIDB4MUNdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnN3onLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC03ei1jb21wcmVzc2VkJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5jaGVjayhbMHg1MiwgMHg2MSwgMHg3MiwgMHgyMSwgMHgxQSwgMHg3XSlcblx0XHRcdCYmICh0aGlzLmJ1ZmZlcls2XSA9PT0gMHgwIHx8IHRoaXMuYnVmZmVyWzZdID09PSAweDEpXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdyYXInLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1yYXItY29tcHJlc3NlZCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdzb2xpZCAnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnc3RsJyxcblx0XHRcdFx0bWltZTogJ21vZGVsL3N0bCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdBQycpKSB7XG5cdFx0XHRjb25zdCB2ZXJzaW9uID0gdGhpcy5idWZmZXIudG9TdHJpbmcoJ2JpbmFyeScsIDIsIDYpO1xuXHRcdFx0aWYgKHZlcnNpb24ubWF0Y2goJ15kKicpICYmIHZlcnNpb24gPj0gMTAwMCAmJiB2ZXJzaW9uIDw9IDEwNTApIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdkd2cnLFxuXHRcdFx0XHRcdG1pbWU6ICdpbWFnZS92bmQuZHdnJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnMDcwNzA3JykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2NwaW8nLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1jcGlvJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gLS0gNy1ieXRlIHNpZ25hdHVyZXMgLS1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdCTEVOREVSJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2JsZW5kJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtYmxlbmRlcicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCchPGFyY2g+JykpIHtcblx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUoOCk7XG5cdFx0XHRjb25zdCBzdHJpbmcgPSBhd2FpdCB0b2tlbml6ZXIucmVhZFRva2VuKG5ldyBUb2tlbi5TdHJpbmdUeXBlKDEzLCAnYXNjaWknKSk7XG5cdFx0XHRpZiAoc3RyaW5nID09PSAnZGViaWFuLWJpbmFyeScpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdkZWInLFxuXHRcdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWRlYicsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2FyJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtdW5peC1hcmNoaXZlJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJyoqQUNFJywge29mZnNldDogN30pKSB7XG5cdFx0XHRhd2FpdCB0b2tlbml6ZXIucGVla0J1ZmZlcih0aGlzLmJ1ZmZlciwge2xlbmd0aDogMTQsIG1heUJlTGVzczogdHJ1ZX0pO1xuXHRcdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJyoqJywge29mZnNldDogMTJ9KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ2FjZScsXG5cdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtYWNlLWNvbXByZXNzZWQnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIC0tIDgtYnl0ZSBzaWduYXR1cmVzIC0tXG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg4OSwgMHg1MCwgMHg0RSwgMHg0NywgMHgwRCwgMHgwQSwgMHgxQSwgMHgwQV0pKSB7XG5cdFx0XHQvLyBBUE5HIGZvcm1hdCAoaHR0cHM6Ly93aWtpLm1vemlsbGEub3JnL0FQTkdfU3BlY2lmaWNhdGlvbilcblx0XHRcdC8vIDEuIEZpbmQgdGhlIGZpcnN0IElEQVQgKGltYWdlIGRhdGEpIGNodW5rICg0OSA0NCA0MSA1NClcblx0XHRcdC8vIDIuIENoZWNrIGlmIHRoZXJlIGlzIGFuIFwiYWNUTFwiIGNodW5rIGJlZm9yZSB0aGUgSURBVCBvbmUgKDYxIDYzIDU0IDRDKVxuXG5cdFx0XHQvLyBPZmZzZXQgY2FsY3VsYXRlZCBhcyBmb2xsb3dzOlxuXHRcdFx0Ly8gLSA4IGJ5dGVzOiBQTkcgc2lnbmF0dXJlXG5cdFx0XHQvLyAtIDQgKGxlbmd0aCkgKyA0IChjaHVuayB0eXBlKSArIDEzIChjaHVuayBkYXRhKSArIDQgKENSQyk6IElIRFIgY2h1bmtcblxuXHRcdFx0YXdhaXQgdG9rZW5pemVyLmlnbm9yZSg4KTsgLy8gaWdub3JlIFBORyBzaWduYXR1cmVcblxuXHRcdFx0YXN5bmMgZnVuY3Rpb24gcmVhZENodW5rSGVhZGVyKCkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGxlbmd0aDogYXdhaXQgdG9rZW5pemVyLnJlYWRUb2tlbihUb2tlbi5JTlQzMl9CRSksXG5cdFx0XHRcdFx0dHlwZTogYXdhaXQgdG9rZW5pemVyLnJlYWRUb2tlbihuZXcgVG9rZW4uU3RyaW5nVHlwZSg0LCAnYmluYXJ5JykpLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRkbyB7XG5cdFx0XHRcdGNvbnN0IGNodW5rID0gYXdhaXQgcmVhZENodW5rSGVhZGVyKCk7XG5cdFx0XHRcdGlmIChjaHVuay5sZW5ndGggPCAwKSB7XG5cdFx0XHRcdFx0cmV0dXJuOyAvLyBJbnZhbGlkIGNodW5rIGxlbmd0aFxuXHRcdFx0XHR9XG5cblx0XHRcdFx0c3dpdGNoIChjaHVuay50eXBlKSB7XG5cdFx0XHRcdFx0Y2FzZSAnSURBVCc6XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRleHQ6ICdwbmcnLFxuXHRcdFx0XHRcdFx0XHRtaW1lOiAnaW1hZ2UvcG5nJyxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0Y2FzZSAnYWNUTCc6XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRleHQ6ICdhcG5nJyxcblx0XHRcdFx0XHRcdFx0bWltZTogJ2ltYWdlL2FwbmcnLFxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdFx0YXdhaXQgdG9rZW5pemVyLmlnbm9yZShjaHVuay5sZW5ndGggKyA0KTsgLy8gSWdub3JlIGNodW5rLWRhdGEgKyBDUkNcblx0XHRcdFx0fVxuXHRcdFx0fSB3aGlsZSAodG9rZW5pemVyLnBvc2l0aW9uICsgOCA8IHRva2VuaXplci5maWxlSW5mby5zaXplKTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAncG5nJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL3BuZycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDQxLCAweDUyLCAweDUyLCAweDRGLCAweDU3LCAweDMxLCAweDAwLCAweDAwXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2Fycm93Jyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtYXBhY2hlLWFycm93Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NjcsIDB4NkMsIDB4NTQsIDB4NDYsIDB4MDIsIDB4MDAsIDB4MDAsIDB4MDBdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZ2xiJyxcblx0XHRcdFx0bWltZTogJ21vZGVsL2dsdGYtYmluYXJ5Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gYG1vdmAgZm9ybWF0IHZhcmlhbnRzXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5jaGVjayhbMHg2NiwgMHg3MiwgMHg2NSwgMHg2NV0sIHtvZmZzZXQ6IDR9KSAvLyBgZnJlZWBcblx0XHRcdHx8IHRoaXMuY2hlY2soWzB4NkQsIDB4NjQsIDB4NjEsIDB4NzRdLCB7b2Zmc2V0OiA0fSkgLy8gYG1kYXRgIE1KUEVHXG5cdFx0XHR8fCB0aGlzLmNoZWNrKFsweDZELCAweDZGLCAweDZGLCAweDc2XSwge29mZnNldDogNH0pIC8vIGBtb292YFxuXHRcdFx0fHwgdGhpcy5jaGVjayhbMHg3NywgMHg2OSwgMHg2NCwgMHg2NV0sIHtvZmZzZXQ6IDR9KSAvLyBgd2lkZWBcblx0XHQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ21vdicsXG5cdFx0XHRcdG1pbWU6ICd2aWRlby9xdWlja3RpbWUnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyAtLSA5LWJ5dGUgc2lnbmF0dXJlcyAtLVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NDksIDB4NDksIDB4NTIsIDB4NEYsIDB4MDgsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MThdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnb3JmJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL3gtb2x5bXB1cy1vcmYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnZ2ltcCB4Y2YgJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3hjZicsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS94LXhjZicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIC0tIDEyLWJ5dGUgc2lnbmF0dXJlcyAtLVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NDksIDB4NDksIDB4NTUsIDB4MDAsIDB4MTgsIDB4MDAsIDB4MDAsIDB4MDAsIDB4ODgsIDB4RTcsIDB4NzQsIDB4RDhdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAncncyJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL3gtcGFuYXNvbmljLXJ3MicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIEFTRl9IZWFkZXJfT2JqZWN0IGZpcnN0IDgwIGJ5dGVzXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MzAsIDB4MjYsIDB4QjIsIDB4NzUsIDB4OEUsIDB4NjYsIDB4Q0YsIDB4MTEsIDB4QTYsIDB4RDldKSkge1xuXHRcdFx0YXN5bmMgZnVuY3Rpb24gcmVhZEhlYWRlcigpIHtcblx0XHRcdFx0Y29uc3QgZ3VpZCA9IEJ1ZmZlci5hbGxvYygxNik7XG5cdFx0XHRcdGF3YWl0IHRva2VuaXplci5yZWFkQnVmZmVyKGd1aWQpO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGlkOiBndWlkLFxuXHRcdFx0XHRcdHNpemU6IE51bWJlcihhd2FpdCB0b2tlbml6ZXIucmVhZFRva2VuKFRva2VuLlVJTlQ2NF9MRSkpLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCB0b2tlbml6ZXIuaWdub3JlKDMwKTtcblx0XHRcdC8vIFNlYXJjaCBmb3IgaGVhZGVyIHNob3VsZCBiZSBpbiBmaXJzdCAxS0Igb2YgZmlsZS5cblx0XHRcdHdoaWxlICh0b2tlbml6ZXIucG9zaXRpb24gKyAyNCA8IHRva2VuaXplci5maWxlSW5mby5zaXplKSB7XG5cdFx0XHRcdGNvbnN0IGhlYWRlciA9IGF3YWl0IHJlYWRIZWFkZXIoKTtcblx0XHRcdFx0bGV0IHBheWxvYWQgPSBoZWFkZXIuc2l6ZSAtIDI0O1xuXHRcdFx0XHRpZiAoX2NoZWNrKGhlYWRlci5pZCwgWzB4OTEsIDB4MDcsIDB4REMsIDB4QjcsIDB4QjcsIDB4QTksIDB4Q0YsIDB4MTEsIDB4OEUsIDB4RTYsIDB4MDAsIDB4QzAsIDB4MEMsIDB4MjAsIDB4NTMsIDB4NjVdKSkge1xuXHRcdFx0XHRcdC8vIFN5bmMgb24gU3RyZWFtLVByb3BlcnRpZXMtT2JqZWN0IChCN0RDMDc5MS1BOUI3LTExQ0YtOEVFNi0wMEMwMEMyMDUzNjUpXG5cdFx0XHRcdFx0Y29uc3QgdHlwZUlkID0gQnVmZmVyLmFsbG9jKDE2KTtcblx0XHRcdFx0XHRwYXlsb2FkIC09IGF3YWl0IHRva2VuaXplci5yZWFkQnVmZmVyKHR5cGVJZCk7XG5cblx0XHRcdFx0XHRpZiAoX2NoZWNrKHR5cGVJZCwgWzB4NDAsIDB4OUUsIDB4NjksIDB4RjgsIDB4NEQsIDB4NUIsIDB4Q0YsIDB4MTEsIDB4QTgsIDB4RkQsIDB4MDAsIDB4ODAsIDB4NUYsIDB4NUMsIDB4NDQsIDB4MkJdKSkge1xuXHRcdFx0XHRcdFx0Ly8gRm91bmQgYXVkaW86XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRleHQ6ICdhc2YnLFxuXHRcdFx0XHRcdFx0XHRtaW1lOiAnYXVkaW8veC1tcy1hc2YnLFxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoX2NoZWNrKHR5cGVJZCwgWzB4QzAsIDB4RUYsIDB4MTksIDB4QkMsIDB4NEQsIDB4NUIsIDB4Q0YsIDB4MTEsIDB4QTgsIDB4RkQsIDB4MDAsIDB4ODAsIDB4NUYsIDB4NUMsIDB4NDQsIDB4MkJdKSkge1xuXHRcdFx0XHRcdFx0Ly8gRm91bmQgdmlkZW86XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRleHQ6ICdhc2YnLFxuXHRcdFx0XHRcdFx0XHRtaW1lOiAndmlkZW8veC1tcy1hc2YnLFxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUocGF5bG9hZCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIERlZmF1bHQgdG8gQVNGIGdlbmVyaWMgZXh0ZW5zaW9uXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdhc2YnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vdm5kLm1zLWFzZicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweEFCLCAweDRCLCAweDU0LCAweDU4LCAweDIwLCAweDMxLCAweDMxLCAweEJCLCAweDBELCAweDBBLCAweDFBLCAweDBBXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2t0eCcsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS9rdHgnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoKHRoaXMuY2hlY2soWzB4N0UsIDB4MTAsIDB4MDRdKSB8fCB0aGlzLmNoZWNrKFsweDdFLCAweDE4LCAweDA0XSkpICYmIHRoaXMuY2hlY2soWzB4MzAsIDB4NEQsIDB4NDksIDB4NDVdLCB7b2Zmc2V0OiA0fSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ21pZScsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LW1pZScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDI3LCAweDBBLCAweDAwLCAweDAwLCAweDAwLCAweDAwLCAweDAwLCAweDAwLCAweDAwLCAweDAwLCAweDAwLCAweDAwXSwge29mZnNldDogMn0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdzaHAnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1lc3JpLXNoYXBlJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4RkYsIDB4NEYsIDB4RkYsIDB4NTFdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnajJjJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL2oyYycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDAwLCAweDAwLCAweDAwLCAweDBDLCAweDZBLCAweDUwLCAweDIwLCAweDIwLCAweDBELCAweDBBLCAweDg3LCAweDBBXSkpIHtcblx0XHRcdC8vIEpQRUctMjAwMCBmYW1pbHlcblxuXHRcdFx0YXdhaXQgdG9rZW5pemVyLmlnbm9yZSgyMCk7XG5cdFx0XHRjb25zdCB0eXBlID0gYXdhaXQgdG9rZW5pemVyLnJlYWRUb2tlbihuZXcgVG9rZW4uU3RyaW5nVHlwZSg0LCAnYXNjaWknKSk7XG5cdFx0XHRzd2l0Y2ggKHR5cGUpIHtcblx0XHRcdFx0Y2FzZSAnanAyICc6XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGV4dDogJ2pwMicsXG5cdFx0XHRcdFx0XHRtaW1lOiAnaW1hZ2UvanAyJyxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRjYXNlICdqcHggJzpcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZXh0OiAnanB4Jyxcblx0XHRcdFx0XHRcdG1pbWU6ICdpbWFnZS9qcHgnLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdGNhc2UgJ2pwbSAnOlxuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRleHQ6ICdqcG0nLFxuXHRcdFx0XHRcdFx0bWltZTogJ2ltYWdlL2pwbScsXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0Y2FzZSAnbWpwMic6XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGV4dDogJ21qMicsXG5cdFx0XHRcdFx0XHRtaW1lOiAnaW1hZ2UvbWoyJyxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoXG5cdFx0XHR0aGlzLmNoZWNrKFsweEZGLCAweDBBXSlcblx0XHRcdHx8IHRoaXMuY2hlY2soWzB4MDAsIDB4MDAsIDB4MDAsIDB4MEMsIDB4NEEsIDB4NTgsIDB4NEMsIDB4MjAsIDB4MEQsIDB4MEEsIDB4ODcsIDB4MEFdKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnanhsJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL2p4bCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweEZFLCAweEZGXSkpIHsgLy8gVVRGLTE2LUJPTS1MRVxuXHRcdFx0aWYgKHRoaXMuY2hlY2soWzAsIDYwLCAwLCA2MywgMCwgMTIwLCAwLCAxMDksIDAsIDEwOF0sIHtvZmZzZXQ6IDJ9KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ3htbCcsXG5cdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3htbCcsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7IC8vIFNvbWUgdW5rbm93biB0ZXh0IGJhc2VkIGZvcm1hdFxuXHRcdH1cblxuXHRcdC8vIC0tIFVuc2FmZSBzaWduYXR1cmVzIC0tXG5cblx0XHRpZiAoXG5cdFx0XHR0aGlzLmNoZWNrKFsweDAsIDB4MCwgMHgxLCAweEJBXSlcblx0XHRcdHx8IHRoaXMuY2hlY2soWzB4MCwgMHgwLCAweDEsIDB4QjNdKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbXBnJyxcblx0XHRcdFx0bWltZTogJ3ZpZGVvL21wZWcnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCwgMHgwMF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd0dGYnLFxuXHRcdFx0XHRtaW1lOiAnZm9udC90dGYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgwMCwgMHgwMCwgMHgwMSwgMHgwMF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdpY28nLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2UveC1pY29uJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MDAsIDB4MDAsIDB4MDIsIDB4MDBdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnY3VyJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL3gtaWNvbicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweEQwLCAweENGLCAweDExLCAweEUwLCAweEExLCAweEIxLCAweDFBLCAweEUxXSkpIHtcblx0XHRcdC8vIERldGVjdGVkIE1pY3Jvc29mdCBDb21wb3VuZCBGaWxlIEJpbmFyeSBGaWxlIChNUy1DRkIpIEZvcm1hdC5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2NmYicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWNmYicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIEluY3JlYXNlIHNhbXBsZSBzaXplIGZyb20gMTIgdG8gMjU2LlxuXHRcdGF3YWl0IHRva2VuaXplci5wZWVrQnVmZmVyKHRoaXMuYnVmZmVyLCB7bGVuZ3RoOiBNYXRoLm1pbigyNTYsIHRva2VuaXplci5maWxlSW5mby5zaXplKSwgbWF5QmVMZXNzOiB0cnVlfSk7XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg2MSwgMHg2MywgMHg3MywgMHg3MF0sIHtvZmZzZXQ6IDM2fSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2ljYycsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQuaWNjcHJvZmlsZScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIC0tIDE1LWJ5dGUgc2lnbmF0dXJlcyAtLVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0JFR0lOOicpKSB7XG5cdFx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnVkNBUkQnLCB7b2Zmc2V0OiA2fSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICd2Y2YnLFxuXHRcdFx0XHRcdG1pbWU6ICd0ZXh0L3ZjYXJkJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ1ZDQUxFTkRBUicsIHtvZmZzZXQ6IDZ9KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ2ljcycsXG5cdFx0XHRcdFx0bWltZTogJ3RleHQvY2FsZW5kYXInLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIGByYWZgIGlzIGhlcmUganVzdCB0byBrZWVwIGFsbCB0aGUgcmF3IGltYWdlIGRldGVjdG9ycyB0b2dldGhlci5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnRlVKSUZJTE1DQ0QtUkFXJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3JhZicsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS94LWZ1amlmaWxtLXJhZicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdFeHRlbmRlZCBNb2R1bGU6JykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3htJyxcblx0XHRcdFx0bWltZTogJ2F1ZGlvL3gteG0nLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnQ3JlYXRpdmUgVm9pY2UgRmlsZScpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd2b2MnLFxuXHRcdFx0XHRtaW1lOiAnYXVkaW8veC12b2MnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgwNCwgMHgwMCwgMHgwMCwgMHgwMF0pICYmIHRoaXMuYnVmZmVyLmxlbmd0aCA+PSAxNikgeyAvLyBSb3VnaCAmIHF1aWNrIGNoZWNrIFBpY2tsZS9BU0FSXG5cdFx0XHRjb25zdCBqc29uU2l6ZSA9IHRoaXMuYnVmZmVyLnJlYWRVSW50MzJMRSgxMik7XG5cdFx0XHRpZiAoanNvblNpemUgPiAxMiAmJiB0aGlzLmJ1ZmZlci5sZW5ndGggPj0ganNvblNpemUgKyAxNikge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IGhlYWRlciA9IHRoaXMuYnVmZmVyLnNsaWNlKDE2LCBqc29uU2l6ZSArIDE2KS50b1N0cmluZygpO1xuXHRcdFx0XHRcdGNvbnN0IGpzb24gPSBKU09OLnBhcnNlKGhlYWRlcik7XG5cdFx0XHRcdFx0Ly8gQ2hlY2sgaWYgUGlja2xlIGlzIEFTQVJcblx0XHRcdFx0XHRpZiAoanNvbi5maWxlcykgeyAvLyBGaW5hbCBjaGVjaywgYXNzdXJpbmcgUGlja2xlL0FTQVIgZm9ybWF0XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRleHQ6ICdhc2FyJyxcblx0XHRcdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtYXNhcicsXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBjYXRjaCB7fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDA2LCAweDBFLCAweDJCLCAweDM0LCAweDAyLCAweDA1LCAweDAxLCAweDAxLCAweDBELCAweDAxLCAweDAyLCAweDAxLCAweDAxLCAweDAyXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ214ZicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9teGYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnU0NSTScsIHtvZmZzZXQ6IDQ0fSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3MzbScsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby94LXMzbScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIFJhdyBNUEVHLTIgdHJhbnNwb3J0IHN0cmVhbSAoMTg4LWJ5dGUgcGFja2V0cylcblx0XHRpZiAodGhpcy5jaGVjayhbMHg0N10pICYmIHRoaXMuY2hlY2soWzB4NDddLCB7b2Zmc2V0OiAxODh9KSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbXRzJyxcblx0XHRcdFx0bWltZTogJ3ZpZGVvL21wMnQnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBCbHUtcmF5IERpc2MgQXVkaW8tVmlkZW8gKEJEQVYpIE1QRUctMiB0cmFuc3BvcnQgc3RyZWFtIGhhcyA0LWJ5dGUgVFBfZXh0cmFfaGVhZGVyIGJlZm9yZSBlYWNoIDE4OC1ieXRlIHBhY2tldFxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDQ3XSwge29mZnNldDogNH0pICYmIHRoaXMuY2hlY2soWzB4NDddLCB7b2Zmc2V0OiAxOTZ9KSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbXRzJyxcblx0XHRcdFx0bWltZTogJ3ZpZGVvL21wMnQnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0MiwgMHg0RiwgMHg0RiwgMHg0QiwgMHg0RCwgMHg0RiwgMHg0MiwgMHg0OV0sIHtvZmZzZXQ6IDYwfSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ21vYmknLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1tb2JpcG9ja2V0LWVib29rJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NDQsIDB4NDksIDB4NDMsIDB4NERdLCB7b2Zmc2V0OiAxMjh9KSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZGNtJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL2RpY29tJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NEMsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIDB4MTQsIDB4MDIsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIDB4QzAsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIDB4NDZdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbG5rJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gubXMuc2hvcnRjdXQnLCAvLyBJbnZlbnRlZCBieSB1c1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg2MiwgMHg2RiwgMHg2RiwgMHg2QiwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgMHg2RCwgMHg2MSwgMHg3MiwgMHg2QiwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdhbGlhcycsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LmFwcGxlLmFsaWFzJywgLy8gSW52ZW50ZWQgYnkgdXNcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0theWRhcmEgRkJYIEJpbmFyeSAgXFx1MDAwMCcpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdmYngnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC5hdXRvZGVzay5mYngnLCAvLyBJbnZlbnRlZCBieSB1c1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoXG5cdFx0XHR0aGlzLmNoZWNrKFsweDRDLCAweDUwXSwge29mZnNldDogMzR9KVxuXHRcdFx0JiYgKFxuXHRcdFx0XHR0aGlzLmNoZWNrKFsweDAwLCAweDAwLCAweDAxXSwge29mZnNldDogOH0pXG5cdFx0XHRcdHx8IHRoaXMuY2hlY2soWzB4MDEsIDB4MDAsIDB4MDJdLCB7b2Zmc2V0OiA4fSlcblx0XHRcdFx0fHwgdGhpcy5jaGVjayhbMHgwMiwgMHgwMCwgMHgwMl0sIHtvZmZzZXQ6IDh9KVxuXHRcdFx0KVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZW90Jyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5tcy1mb250b2JqZWN0Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MDYsIDB4MDYsIDB4RUQsIDB4RjUsIDB4RDgsIDB4MUQsIDB4NDYsIDB4RTUsIDB4QkQsIDB4MzEsIDB4RUYsIDB4RTcsIDB4RkUsIDB4NzQsIDB4QjcsIDB4MURdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnaW5kZCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWluZGVzaWduJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gSW5jcmVhc2Ugc2FtcGxlIHNpemUgZnJvbSAyNTYgdG8gNTEyXG5cdFx0YXdhaXQgdG9rZW5pemVyLnBlZWtCdWZmZXIodGhpcy5idWZmZXIsIHtsZW5ndGg6IE1hdGgubWluKDUxMiwgdG9rZW5pemVyLmZpbGVJbmZvLnNpemUpLCBtYXlCZUxlc3M6IHRydWV9KTtcblxuXHRcdC8vIFJlcXVpcmVzIGEgYnVmZmVyIHNpemUgb2YgNTEyIGJ5dGVzXG5cdFx0aWYgKHRhckhlYWRlckNoZWNrc3VtTWF0Y2hlcyh0aGlzLmJ1ZmZlcikpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3RhcicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LXRhcicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweEZGLCAweEZFXSkpIHsgLy8gVVRGLTE2LUJPTS1CRVxuXHRcdFx0aWYgKHRoaXMuY2hlY2soWzYwLCAwLCA2MywgMCwgMTIwLCAwLCAxMDksIDAsIDEwOCwgMF0sIHtvZmZzZXQ6IDJ9KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ3htbCcsXG5cdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3htbCcsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmNoZWNrKFsweEZGLCAweDBFLCAweDUzLCAweDAwLCAweDZCLCAweDAwLCAweDY1LCAweDAwLCAweDc0LCAweDAwLCAweDYzLCAweDAwLCAweDY4LCAweDAwLCAweDU1LCAweDAwLCAweDcwLCAweDAwLCAweDIwLCAweDAwLCAweDRELCAweDAwLCAweDZGLCAweDAwLCAweDY0LCAweDAwLCAweDY1LCAweDAwLCAweDZDLCAweDAwXSwge29mZnNldDogMn0pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnc2twJyxcblx0XHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vdm5kLnNrZXRjaHVwLnNrcCcsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7IC8vIFNvbWUgdGV4dCBiYXNlZCBmb3JtYXRcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnLS0tLS1CRUdJTiBQR1AgTUVTU0FHRS0tLS0tJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3BncCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9wZ3AtZW5jcnlwdGVkJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgTVBFRyAxIG9yIDIgTGF5ZXIgMyBoZWFkZXIsIG9yICdsYXllciAwJyBmb3IgQURUUyAoTVBFRyBzeW5jLXdvcmQgMHhGRkUpXG5cdFx0aWYgKHRoaXMuYnVmZmVyLmxlbmd0aCA+PSAyICYmIHRoaXMuY2hlY2soWzB4RkYsIDB4RTBdLCB7b2Zmc2V0OiAwLCBtYXNrOiBbMHhGRiwgMHhFMF19KSkge1xuXHRcdFx0aWYgKHRoaXMuY2hlY2soWzB4MTBdLCB7b2Zmc2V0OiAxLCBtYXNrOiBbMHgxNl19KSkge1xuXHRcdFx0XHQvLyBDaGVjayBmb3IgKEFEVFMpIE1QRUctMlxuXHRcdFx0XHRpZiAodGhpcy5jaGVjayhbMHgwOF0sIHtvZmZzZXQ6IDEsIG1hc2s6IFsweDA4XX0pKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGV4dDogJ2FhYycsXG5cdFx0XHRcdFx0XHRtaW1lOiAnYXVkaW8vYWFjJyxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gTXVzdCBiZSAoQURUUykgTVBFRy00XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnYWFjJyxcblx0XHRcdFx0XHRtaW1lOiAnYXVkaW8vYWFjJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gTVBFRyAxIG9yIDIgTGF5ZXIgMyBoZWFkZXJcblx0XHRcdC8vIENoZWNrIGZvciBNUEVHIGxheWVyIDNcblx0XHRcdGlmICh0aGlzLmNoZWNrKFsweDAyXSwge29mZnNldDogMSwgbWFzazogWzB4MDZdfSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdtcDMnLFxuXHRcdFx0XHRcdG1pbWU6ICdhdWRpby9tcGVnJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ2hlY2sgZm9yIE1QRUcgbGF5ZXIgMlxuXHRcdFx0aWYgKHRoaXMuY2hlY2soWzB4MDRdLCB7b2Zmc2V0OiAxLCBtYXNrOiBbMHgwNl19KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ21wMicsXG5cdFx0XHRcdFx0bWltZTogJ2F1ZGlvL21wZWcnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBDaGVjayBmb3IgTVBFRyBsYXllciAxXG5cdFx0XHRpZiAodGhpcy5jaGVjayhbMHgwNl0sIHtvZmZzZXQ6IDEsIG1hc2s6IFsweDA2XX0pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnbXAxJyxcblx0XHRcdFx0XHRtaW1lOiAnYXVkaW8vbXBlZycsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcmVhZFRpZmZUYWcoYmlnRW5kaWFuKSB7XG5cdFx0Y29uc3QgdGFnSWQgPSBhd2FpdCB0aGlzLnRva2VuaXplci5yZWFkVG9rZW4oYmlnRW5kaWFuID8gVG9rZW4uVUlOVDE2X0JFIDogVG9rZW4uVUlOVDE2X0xFKTtcblx0XHR0aGlzLnRva2VuaXplci5pZ25vcmUoMTApO1xuXHRcdHN3aXRjaCAodGFnSWQpIHtcblx0XHRcdGNhc2UgNTBfMzQxOlxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ2FydycsXG5cdFx0XHRcdFx0bWltZTogJ2ltYWdlL3gtc29ueS1hcncnLFxuXHRcdFx0XHR9O1xuXHRcdFx0Y2FzZSA1MF83MDY6XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnZG5nJyxcblx0XHRcdFx0XHRtaW1lOiAnaW1hZ2UveC1hZG9iZS1kbmcnLFxuXHRcdFx0XHR9O1xuXHRcdFx0ZGVmYXVsdDpcblx0XHR9XG5cdH1cblxuXHRhc3luYyByZWFkVGlmZklGRChiaWdFbmRpYW4pIHtcblx0XHRjb25zdCBudW1iZXJPZlRhZ3MgPSBhd2FpdCB0aGlzLnRva2VuaXplci5yZWFkVG9rZW4oYmlnRW5kaWFuID8gVG9rZW4uVUlOVDE2X0JFIDogVG9rZW4uVUlOVDE2X0xFKTtcblx0XHRmb3IgKGxldCBuID0gMDsgbiA8IG51bWJlck9mVGFnczsgKytuKSB7XG5cdFx0XHRjb25zdCBmaWxlVHlwZSA9IGF3YWl0IHRoaXMucmVhZFRpZmZUYWcoYmlnRW5kaWFuKTtcblx0XHRcdGlmIChmaWxlVHlwZSkge1xuXHRcdFx0XHRyZXR1cm4gZmlsZVR5cGU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcmVhZFRpZmZIZWFkZXIoYmlnRW5kaWFuKSB7XG5cdFx0Y29uc3QgdmVyc2lvbiA9IChiaWdFbmRpYW4gPyBUb2tlbi5VSU5UMTZfQkUgOiBUb2tlbi5VSU5UMTZfTEUpLmdldCh0aGlzLmJ1ZmZlciwgMik7XG5cdFx0Y29uc3QgaWZkT2Zmc2V0ID0gKGJpZ0VuZGlhbiA/IFRva2VuLlVJTlQzMl9CRSA6IFRva2VuLlVJTlQzMl9MRSkuZ2V0KHRoaXMuYnVmZmVyLCA0KTtcblxuXHRcdGlmICh2ZXJzaW9uID09PSA0Mikge1xuXHRcdFx0Ly8gVElGRiBmaWxlIGhlYWRlclxuXHRcdFx0aWYgKGlmZE9mZnNldCA+PSA2KSB7XG5cdFx0XHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdDUicsIHtvZmZzZXQ6IDh9KSkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRleHQ6ICdjcjInLFxuXHRcdFx0XHRcdFx0bWltZTogJ2ltYWdlL3gtY2Fub24tY3IyJyxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGlmZE9mZnNldCA+PSA4ICYmICh0aGlzLmNoZWNrKFsweDFDLCAweDAwLCAweEZFLCAweDAwXSwge29mZnNldDogOH0pIHx8IHRoaXMuY2hlY2soWzB4MUYsIDB4MDAsIDB4MEIsIDB4MDBdLCB7b2Zmc2V0OiA4fSkpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGV4dDogJ25lZicsXG5cdFx0XHRcdFx0XHRtaW1lOiAnaW1hZ2UveC1uaWtvbi1uZWYnLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0YXdhaXQgdGhpcy50b2tlbml6ZXIuaWdub3JlKGlmZE9mZnNldCk7XG5cdFx0XHRjb25zdCBmaWxlVHlwZSA9IGF3YWl0IHRoaXMucmVhZFRpZmZJRkQoYmlnRW5kaWFuKTtcblx0XHRcdHJldHVybiBmaWxlVHlwZSA/PyB7XG5cdFx0XHRcdGV4dDogJ3RpZicsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS90aWZmJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHZlcnNpb24gPT09IDQzKSB7XHQvLyBCaWcgVElGRiBmaWxlIGhlYWRlclxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAndGlmJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL3RpZmYnLFxuXHRcdFx0fTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbGVUeXBlU3RyZWFtKHJlYWRhYmxlU3RyZWFtLCBvcHRpb25zID0ge30pIHtcblx0cmV0dXJuIG5ldyBGaWxlVHlwZVBhcnNlcigpLnRvRGV0ZWN0aW9uU3RyZWFtKHJlYWRhYmxlU3RyZWFtLCBvcHRpb25zKTtcbn1cblxuZXhwb3J0IGNvbnN0IHN1cHBvcnRlZEV4dGVuc2lvbnMgPSBuZXcgU2V0KGV4dGVuc2lvbnMpO1xuZXhwb3J0IGNvbnN0IHN1cHBvcnRlZE1pbWVUeXBlcyA9IG5ldyBTZXQobWltZVR5cGVzKTtcbiIsImltcG9ydCB7ZmlsZVR5cGVGcm9tQnVmZmVyfSBmcm9tICdmaWxlLXR5cGUnO1xuXG5jb25zdCBpbWFnZUV4dGVuc2lvbnMgPSBuZXcgU2V0KFtcblx0J2pwZycsXG5cdCdwbmcnLFxuXHQnZ2lmJyxcblx0J3dlYnAnLFxuXHQnZmxpZicsXG5cdCdjcjInLFxuXHQndGlmJyxcblx0J2JtcCcsXG5cdCdqeHInLFxuXHQncHNkJyxcblx0J2ljbycsXG5cdCdicGcnLFxuXHQnanAyJyxcblx0J2pwbScsXG5cdCdqcHgnLFxuXHQnaGVpYycsXG5cdCdjdXInLFxuXHQnZGNtJyxcblx0J2F2aWYnLFxuXSk7XG5cbmV4cG9ydCBkZWZhdWx0IGFzeW5jIGZ1bmN0aW9uIGltYWdlVHlwZShpbnB1dCkge1xuXHRjb25zdCByZXN1bHQgPSBhd2FpdCBmaWxlVHlwZUZyb21CdWZmZXIoaW5wdXQpO1xuXHRyZXR1cm4gaW1hZ2VFeHRlbnNpb25zLmhhcyhyZXN1bHQ/LmV4dCkgJiYgcmVzdWx0O1xufVxuXG5leHBvcnQgY29uc3QgbWluaW11bUJ5dGVzID0gNDEwMDtcbiIsIi8vINin2YTYudix2KjZitipXG5cbmV4cG9ydCBkZWZhdWx0IHt9O1xuIiwiLy8gxI1lxaF0aW5hXG5cbmV4cG9ydCBkZWZhdWx0IHt9O1xuIiwiLy8gRGFuc2tcblxuZXhwb3J0IGRlZmF1bHQge307XG4iLCIvLyBEZXV0c2NoXG5cbmV4cG9ydCBkZWZhdWx0IHt9OyIsIi8vIEVuZ2xpc2hcblxuZXhwb3J0IGRlZmF1bHQge1xuICAvLyBzZXR0aW5nLnRzXG4gIFwiUGx1Z2luIFNldHRpbmdzXCI6IFwiUGx1Z2luIFNldHRpbmdzXCIsXG4gIFwiQXV0byBwYXN0ZWQgdXBsb2FkXCI6IFwiQXV0byBwYXN0ZWQgdXBsb2FkXCIsXG4gIFwiSWYgeW91IHNldCB0aGlzIHZhbHVlIHRydWUsIHdoZW4geW91IHBhc3RlIGltYWdlLCBpdCB3aWxsIGJlIGF1dG8gdXBsb2FkZWQoeW91IHNob3VsZCBzZXQgdGhlIHBpY0dvIHNlcnZlciByaWdodGx5KVwiOlxuICAgIFwiSWYgeW91IHNldCB0aGlzIHZhbHVlIHRydWUsIHdoZW4geW91IHBhc3RlIGltYWdlLCBpdCB3aWxsIGJlIGF1dG8gdXBsb2FkZWQoeW91IHNob3VsZCBzZXQgdGhlIHBpY0dvIHNlcnZlciByaWdodGx5KVwiLFxuICBcIkRlZmF1bHQgdXBsb2FkZXJcIjogXCJEZWZhdWx0IHVwbG9hZGVyXCIsXG4gIFwiUGljR28gc2VydmVyXCI6IFwiUGljR28gc2VydmVyIHVwbG9hZCByb3V0ZVwiLFxuICBcIlBpY0dvIHNlcnZlciBkZXNjXCI6XG4gICAgXCJ1cGxvYWQgcm91dGUsIHVzZSBQaWNMaXN0IHdpbGwgYmUgYWJsZSB0byBzZXQgcGljYmVkIGFuZCBjb25maWcgdGhyb3VnaCBxdWVyeVwiLFxuICBcIlBsZWFzZSBpbnB1dCBQaWNHbyBzZXJ2ZXJcIjogXCJQbGVhc2UgaW5wdXQgdXBsb2FkIHJvdXRlXCIsXG4gIFwiUGljR28gZGVsZXRlIHNlcnZlclwiOlxuICAgIFwiUGljR28gc2VydmVyIGRlbGV0ZSByb3V0ZSh5b3UgbmVlZCB0byB1c2UgUGljTGlzdCBhcHApXCIsXG4gIFwiUGljTGlzdCBkZXNjXCI6IFwiU2VhcmNoIFBpY0xpc3Qgb24gR2l0aHViIHRvIGRvd25sb2FkIGFuZCBpbnN0YWxsXCIsXG4gIFwiUGxlYXNlIGlucHV0IFBpY0dvIGRlbGV0ZSBzZXJ2ZXJcIjogXCJQbGVhc2UgaW5wdXQgZGVsZXRlIHNlcnZlclwiLFxuICBcIkRlbGV0ZSBpbWFnZSB1c2luZyBQaWNMaXN0XCI6IFwiRGVsZXRlIGltYWdlIHVzaW5nIFBpY0xpc3RcIixcbiAgXCJQaWNHby1Db3JlIHBhdGhcIjogXCJQaWNHby1Db3JlIHBhdGhcIixcbiAgXCJEZWxldGUgc3VjY2Vzc2Z1bGx5XCI6IFwiRGVsZXRlIHN1Y2Nlc3NmdWxseVwiLFxuICBcIkRlbGV0ZSBmYWlsZWRcIjogXCJEZWxldGUgZmFpbGVkXCIsXG4gIFwiSW1hZ2Ugc2l6ZSBzdWZmaXhcIjogXCJJbWFnZSBzaXplIHN1ZmZpeFwiLFxuICBcIkltYWdlIHNpemUgc3VmZml4IERlc2NyaXB0aW9uXCI6IFwibGlrZSB8MzAwIGZvciByZXNpemUgaW1hZ2UgaW4gb2IuXCIsXG4gIFwiUGxlYXNlIGlucHV0IGltYWdlIHNpemUgc3VmZml4XCI6IFwiUGxlYXNlIGlucHV0IGltYWdlIHNpemUgc3VmZml4XCIsXG4gIFwiRXJyb3IsIGNvdWxkIG5vdCBkZWxldGVcIjogXCJFcnJvciwgY291bGQgbm90IGRlbGV0ZVwiLFxuICBcIlBsZWFzZSBpbnB1dCBQaWNHby1Db3JlIHBhdGgsIGRlZmF1bHQgdXNpbmcgZW52aXJvbm1lbnQgdmFyaWFibGVzXCI6XG4gICAgXCJQbGVhc2UgaW5wdXQgUGljR28tQ29yZSBwYXRoLCBkZWZhdWx0IHVzaW5nIGVudmlyb25tZW50IHZhcmlhYmxlc1wiLFxuICBcIldvcmsgb24gbmV0d29ya1wiOiBcIldvcmsgb24gbmV0d29ya1wiLFxuICBcIldvcmsgb24gbmV0d29yayBEZXNjcmlwdGlvblwiOlxuICAgIFwiQWxsb3cgdXBsb2FkIG5ldHdvcmsgaW1hZ2UgYnkgJ1VwbG9hZCBhbGwnIGNvbW1hbmQuXFxuIE9yIHdoZW4geW91IHBhc3RlLCBtZCBzdGFuZGFyZCBpbWFnZSBsaW5rIGluIHlvdXIgY2xpcGJvYXJkIHdpbGwgYmUgYXV0byB1cGxvYWQuXCIsXG4gIGZpeFBhdGg6IFwiZml4UGF0aFwiLFxuICBmaXhQYXRoV2FybmluZzpcbiAgICBcIlRoaXMgb3B0aW9uIGlzIHVzZWQgdG8gZml4IFBpY0dvLWNvcmUgdXBsb2FkIGZhaWx1cmVzIG9uIExpbnV4IGFuZCBNYWMuIEl0IG1vZGlmaWVzIHRoZSBQQVRIIHZhcmlhYmxlIHdpdGhpbiBPYnNpZGlhbi4gSWYgT2JzaWRpYW4gZW5jb3VudGVycyBhbnkgYnVncywgdHVybiBvZmYgdGhlIG9wdGlvbiwgdHJ5IGFnYWluISBcIixcbiAgXCJVcGxvYWQgd2hlbiBjbGlwYm9hcmQgaGFzIGltYWdlIGFuZCB0ZXh0IHRvZ2V0aGVyXCI6XG4gICAgXCJVcGxvYWQgd2hlbiBjbGlwYm9hcmQgaGFzIGltYWdlIGFuZCB0ZXh0IHRvZ2V0aGVyXCIsXG4gIFwiV2hlbiB5b3UgY29weSwgc29tZSBhcHBsaWNhdGlvbiBsaWtlIEV4Y2VsIHdpbGwgaW1hZ2UgYW5kIHRleHQgdG8gY2xpcGJvYXJkLCB5b3UgY2FuIHVwbG9hZCBvciBub3QuXCI6XG4gICAgXCJXaGVuIHlvdSBjb3B5LCBzb21lIGFwcGxpY2F0aW9uIGxpa2UgRXhjZWwgd2lsbCBpbWFnZSBhbmQgdGV4dCB0byBjbGlwYm9hcmQsIHlvdSBjYW4gdXBsb2FkIG9yIG5vdC5cIixcbiAgXCJOZXR3b3JrIERvbWFpbiBCbGFjayBMaXN0XCI6IFwiTmV0d29yayBEb21haW4gQmxhY2sgTGlzdFwiLFxuICBcIk5ldHdvcmsgRG9tYWluIEJsYWNrIExpc3QgRGVzY3JpcHRpb25cIjpcbiAgICBcIkltYWdlIGluIHRoZSBkb21haW4gbGlzdCB3aWxsIG5vdCBiZSB1cGxvYWQsdXNlIGNvbW1hIHNlcGFyYXRlZFwiLFxuICBcIkRlbGV0ZSBzb3VyY2UgZmlsZSBhZnRlciB5b3UgdXBsb2FkIGZpbGVcIjpcbiAgICBcIkRlbGV0ZSBzb3VyY2UgZmlsZSBhZnRlciB5b3UgdXBsb2FkIGZpbGVcIixcbiAgXCJEZWxldGUgc291cmNlIGZpbGUgaW4gb2IgYXNzZXRzIGFmdGVyIHlvdSB1cGxvYWQgZmlsZS5cIjpcbiAgICBcIkRlbGV0ZSBzb3VyY2UgZmlsZSBpbiBvYiBhc3NldHMgYWZ0ZXIgeW91IHVwbG9hZCBmaWxlLlwiLFxuICBcIkltYWdlIGRlc2NcIjogXCJJbWFnZSBkZXNjXCIsXG4gIHJlc2VydmU6IFwiZGVmYXVsdFwiLFxuICBcInJlbW92ZSBhbGxcIjogXCJub25lXCIsXG4gIFwicmVtb3ZlIGRlZmF1bHRcIjogXCJyZW1vdmUgaW1hZ2UucG5nXCIsXG4gIFwiUmVtb3RlIHNlcnZlciBtb2RlXCI6IFwiUmVtb3RlIHNlcnZlciBtb2RlXCIsXG4gIFwiUmVtb3RlIHNlcnZlciBtb2RlIGRlc2NcIjpcbiAgICBcIklmIHlvdSBoYXZlIGRlcGxveWVkIHBpY2xpc3QtY29yZSBvciBwaWNsaXN0IG9uIHRoZSBzZXJ2ZXIuXCIsXG4gIFwiQ2FuIG5vdCBmaW5kIGltYWdlIGZpbGVcIjogXCJDYW4gbm90IGZpbmQgaW1hZ2UgZmlsZVwiLFxuICBcIkZpbGUgaGFzIGJlZW4gY2hhbmdlZGQsIHVwbG9hZCBmYWlsdXJlXCI6XG4gICAgXCJGaWxlIGhhcyBiZWVuIGNoYW5nZWRkLCB1cGxvYWQgZmFpbHVyZVwiLFxuICBcIkZpbGUgaGFzIGJlZW4gY2hhbmdlZGQsIGRvd25sb2FkIGZhaWx1cmVcIjpcbiAgICBcIkZpbGUgaGFzIGJlZW4gY2hhbmdlZGQsIGRvd25sb2FkIGZhaWx1cmVcIixcbiAgXCJXYXJuaW5nOiB1cGxvYWQgZmlsZXMgaXMgZGlmZmVyZW50IG9mIHJlY2l2ZXIgZmlsZXMgZnJvbSBhcGlcIjpcbiAgICBcIldhcm5pbmc6IHVwbG9hZCBmaWxlcyBudW0gaXMgZGlmZmVyZW50IG9mIHJlY2l2ZXIgZmlsZXMgZnJvbSBhcGlcIixcbn07XG4iLCIvLyBCcml0aXNoIEVuZ2xpc2hcblxuZXhwb3J0IGRlZmF1bHQge307XG4iLCIvLyBFc3Bhw7FvbFxuXG5leHBvcnQgZGVmYXVsdCB7fTtcbiIsIi8vIGZyYW7Dp2Fpc1xuXG5leHBvcnQgZGVmYXVsdCB7fTtcbiIsIi8vIOCkueCkv+CkqOCljeCkpuClgFxuXG5leHBvcnQgZGVmYXVsdCB7fTtcbiIsIi8vIEJhaGFzYSBJbmRvbmVzaWFcblxuZXhwb3J0IGRlZmF1bHQge307XG4iLCIvLyBJdGFsaWFub1xuXG5leHBvcnQgZGVmYXVsdCB7fTtcbiIsIi8vIOaXpeacrOiqnlxuXG5leHBvcnQgZGVmYXVsdCB7fTsiLCIvLyDtlZzqta3slrRcblxuZXhwb3J0IGRlZmF1bHQge307XG4iLCIvLyBOZWRlcmxhbmRzXG5cbmV4cG9ydCBkZWZhdWx0IHt9O1xuIiwiLy8gTm9yc2tcblxuZXhwb3J0IGRlZmF1bHQge307XG4iLCIvLyBqxJl6eWsgcG9sc2tpXG5cbmV4cG9ydCBkZWZhdWx0IHt9O1xuIiwiLy8gUG9ydHVndcOqc1xuXG5leHBvcnQgZGVmYXVsdCB7fTtcbiIsIi8vIFBvcnR1Z3XDqnMgZG8gQnJhc2lsXG4vLyBCcmF6aWxpYW4gUG9ydHVndWVzZVxuXG5leHBvcnQgZGVmYXVsdCB7fTsiLCIvLyBSb23Dom7Eg1xuXG5leHBvcnQgZGVmYXVsdCB7fTtcbiIsIi8vINGA0YPRgdGB0LrQuNC5XG5cbmV4cG9ydCBkZWZhdWx0IHt9O1xuIiwiLy8gVMO8cmvDp2VcblxuZXhwb3J0IGRlZmF1bHQge307XG4iLCIvLyDnroDkvZPkuK3mlodcblxuZXhwb3J0IGRlZmF1bHQge1xuICAvLyBzZXR0aW5nLnRzXG4gIFwiUGx1Z2luIFNldHRpbmdzXCI6IFwi5o+S5Lu26K6+572uXCIsXG4gIFwiQXV0byBwYXN0ZWQgdXBsb2FkXCI6IFwi5Ymq5YiH5p2/6Ieq5Yqo5LiK5LygXCIsXG4gIFwiSWYgeW91IHNldCB0aGlzIHZhbHVlIHRydWUsIHdoZW4geW91IHBhc3RlIGltYWdlLCBpdCB3aWxsIGJlIGF1dG8gdXBsb2FkZWQoeW91IHNob3VsZCBzZXQgdGhlIHBpY0dvIHNlcnZlciByaWdodGx5KVwiOlxuICAgIFwi5ZCv55So6K+l6YCJ6aG55ZCO77yM6buP6LS05Zu+54mH5pe25Lya6Ieq5Yqo5LiK5Lyg77yI5L2g6ZyA6KaB5q2j56Gu6YWN572ucGljZ2/vvIlcIixcbiAgXCJEZWZhdWx0IHVwbG9hZGVyXCI6IFwi6buY6K6k5LiK5Lyg5ZmoXCIsXG4gIFwiUGljR28gc2VydmVyXCI6IFwiUGljR28gc2VydmVyIOS4iuS8oOaOpeWPo1wiLFxuICBcIlBpY0dvIHNlcnZlciBkZXNjXCI6IFwi5LiK5Lyg5o6l5Y+j77yM5L2/55SoUGljTGlzdOaXtuWPr+mAmui/h+iuvue9rlVSTOWPguaVsOaMh+WumuWbvuW6iuWSjOmFjee9rlwiLFxuICBcIlBsZWFzZSBpbnB1dCBQaWNHbyBzZXJ2ZXJcIjogXCLor7fovpPlhaXkuIrkvKDmjqXlj6PlnLDlnYBcIixcbiAgXCJQaWNHbyBkZWxldGUgc2VydmVyXCI6IFwiUGljR28gc2VydmVyIOWIoOmZpOaOpeWPoyjor7fkvb/nlKhQaWNMaXN05p2l5ZCv55So5q2k5Yqf6IO9KVwiLFxuICBcIlBpY0xpc3QgZGVzY1wiOiBcIlBpY0xpc3TmmK9QaWNHb+S6jOasoeW8gOWPkeeJiO+8jOivt0dpdGh1YuaQnOe0olBpY0xpc3TkuIvovb1cIixcbiAgXCJQbGVhc2UgaW5wdXQgUGljR28gZGVsZXRlIHNlcnZlclwiOiBcIuivt+i+k+WFpeWIoOmZpOaOpeWPo+WcsOWdgFwiLFxuICBcIkRlbGV0ZSBpbWFnZSB1c2luZyBQaWNMaXN0XCI6IFwi5L2/55SoIFBpY0xpc3Qg5Yig6Zmk5Zu+54mHXCIsXG4gIFwiUGljR28tQ29yZSBwYXRoXCI6IFwiUGljR28tQ29yZSDot6/lvoRcIixcbiAgXCJEZWxldGUgc3VjY2Vzc2Z1bGx5XCI6IFwi5Yig6Zmk5oiQ5YqfXCIsXG4gIFwiRGVsZXRlIGZhaWxlZFwiOiBcIuWIoOmZpOWksei0pVwiLFxuICBcIkVycm9yLCBjb3VsZCBub3QgZGVsZXRlXCI6IFwi6ZSZ6K+v77yM5peg5rOV5Yig6ZmkXCIsXG4gIFwiSW1hZ2Ugc2l6ZSBzdWZmaXhcIjogXCLlm77niYflpKflsI/lkI7nvIBcIixcbiAgXCJJbWFnZSBzaXplIHN1ZmZpeCBEZXNjcmlwdGlvblwiOiBcIuavlOWmgu+8mnwzMDAg55So5LqO6LCD5pW05Zu+54mH5aSn5bCPXCIsXG4gIFwiUGxlYXNlIGlucHV0IGltYWdlIHNpemUgc3VmZml4XCI6IFwi6K+36L6T5YWl5Zu+54mH5aSn5bCP5ZCO57yAXCIsXG4gIFwiUGxlYXNlIGlucHV0IFBpY0dvLUNvcmUgcGF0aCwgZGVmYXVsdCB1c2luZyBlbnZpcm9ubWVudCB2YXJpYWJsZXNcIjpcbiAgICBcIuivt+i+k+WFpSBQaWNHby1Db3JlIHBhdGjvvIzpu5jorqTkvb/nlKjnjq/looPlj5jph49cIixcbiAgXCJXb3JrIG9uIG5ldHdvcmtcIjogXCLlupTnlKjnvZHnu5zlm77niYdcIixcbiAgXCJXb3JrIG9uIG5ldHdvcmsgRGVzY3JpcHRpb25cIjpcbiAgICBcIuW9k+S9oOS4iuS8oOaJgOacieWbvueJh+aXtu+8jOS5n+S8muS4iuS8oOe9kee7nOWbvueJh+OAguS7peWPiuW9k+S9oOi/m+ihjOm7j+i0tOaXtu+8jOWJquWIh+adv+S4reeahOagh+WHhiBtZCDlm77niYfkvJrooqvkuIrkvKBcIixcbiAgZml4UGF0aDogXCLkv67mraNQQVRI5Y+Y6YePXCIsXG4gIGZpeFBhdGhXYXJuaW5nOlxuICAgIFwi5q2k6YCJ6aG555So5LqO5L+u5aSNTGludXjlkoxNYWPkuIogUGljR28tQ29yZSDkuIrkvKDlpLHotKXnmoTpl67popjjgILlroPkvJrkv67mlLkgT2JzaWRpYW4g5YaF55qEIFBBVEgg5Y+Y6YeP77yM5aaC5p6cIE9ic2lkaWFuIOmBh+WIsOS7u+S9lUJVR++8jOWFiOWFs+mXrei/meS4qumAiemhueivleivle+8gVwiLFxuICBcIlVwbG9hZCB3aGVuIGNsaXBib2FyZCBoYXMgaW1hZ2UgYW5kIHRleHQgdG9nZXRoZXJcIjpcbiAgICBcIuW9k+WJquWIh+adv+WQjOaXtuaLpeacieaWh+acrOWSjOWbvueJh+WJquWIh+adv+aVsOaNruaXtuaYr+WQpuS4iuS8oOWbvueJh1wiLFxuICBcIldoZW4geW91IGNvcHksIHNvbWUgYXBwbGljYXRpb24gbGlrZSBFeGNlbCB3aWxsIGltYWdlIGFuZCB0ZXh0IHRvIGNsaXBib2FyZCwgeW91IGNhbiB1cGxvYWQgb3Igbm90LlwiOlxuICAgIFwi5b2T5L2g5aSN5Yi25pe277yM5p+Q5Lqb5bqU55So5L6L5aaCIEV4Y2VsIOS8muWcqOWJquWIh+adv+WQjOaXtuaWh+acrOWSjOWbvuWDj+aVsOaNru+8jOehruiupOaYr+WQpuS4iuS8oOOAglwiLFxuICBcIk5ldHdvcmsgRG9tYWluIEJsYWNrIExpc3RcIjogXCLnvZHnu5zlm77niYfln5/lkI3pu5HlkI3ljZVcIixcbiAgXCJOZXR3b3JrIERvbWFpbiBCbGFjayBMaXN0IERlc2NyaXB0aW9uXCI6XG4gICAgXCLpu5HlkI3ljZXln5/lkI3kuK3nmoTlm77niYflsIbkuI3kvJrooqvkuIrkvKDvvIznlKjoi7HmlofpgJflj7fliIblibJcIixcbiAgXCJEZWxldGUgc291cmNlIGZpbGUgYWZ0ZXIgeW91IHVwbG9hZCBmaWxlXCI6IFwi5LiK5Lyg5paH5Lu25ZCO56e76Zmk5rqQ5paH5Lu2XCIsXG4gIFwiRGVsZXRlIHNvdXJjZSBmaWxlIGluIG9iIGFzc2V0cyBhZnRlciB5b3UgdXBsb2FkIGZpbGUuXCI6XG4gICAgXCLkuIrkvKDmlofku7blkI7np7vpmaTlnKhvYumZhOS7tuaWh+S7tuWkueS4reeahOaWh+S7tlwiLFxuICBcIkltYWdlIGRlc2NcIjogXCLlm77niYfmj4/ov7BcIixcbiAgcmVzZXJ2ZTogXCLpu5jorqRcIixcbiAgXCJyZW1vdmUgYWxsXCI6IFwi5pegXCIsXG4gIFwicmVtb3ZlIGRlZmF1bHRcIjogXCLnp7vpmaRpbWFnZS5wbmdcIixcbiAgXCJSZW1vdGUgc2VydmVyIG1vZGVcIjogXCLov5znqIvmnI3liqHlmajmqKHlvI9cIixcbiAgXCJSZW1vdGUgc2VydmVyIG1vZGUgZGVzY1wiOiBcIuWmguaenOS9oOWcqOacjeWKoeWZqOmDqOe9suS6hnBpY2xpc3QtY29yZeaIluiAhXBpY2xpc3RcIixcbiAgXCJDYW4gbm90IGZpbmQgaW1hZ2UgZmlsZVwiOiBcIuayoeacieino+aekOWIsOWbvuWDj+aWh+S7tlwiLFxuICBcIkZpbGUgaGFzIGJlZW4gY2hhbmdlZGQsIHVwbG9hZCBmYWlsdXJlXCI6IFwi5b2T5YmN5paH5Lu25bey5Y+Y5pu077yM5LiK5Lyg5aSx6LSlXCIsXG4gIFwiRmlsZSBoYXMgYmVlbiBjaGFuZ2VkZCwgZG93bmxvYWQgZmFpbHVyZVwiOiBcIuW9k+WJjeaWh+S7tuW3suWPmOabtO+8jOS4i+i9veWksei0pVwiLFxuICBcIldhcm5pbmc6IHVwbG9hZCBmaWxlcyBpcyBkaWZmZXJlbnQgb2YgcmVjaXZlciBmaWxlcyBmcm9tIGFwaVwiOlxuICAgIFwi6K2m5ZGK77ya5LiK5Lyg55qE5paH5Lu25LiO5o6l5Y+j6L+U5Zue55qE5paH5Lu25pWw6YeP5LiN5LiA6Ie0XCIsXG59O1xuIiwiLy8g57mB6auU5Lit5paHXG5cbmV4cG9ydCBkZWZhdWx0IHt9O1xuIiwiaW1wb3J0IHsgbW9tZW50IH0gZnJvbSAnb2JzaWRpYW4nO1xuXG5pbXBvcnQgYXIgZnJvbSAnLi9sb2NhbGUvYXInO1xuaW1wb3J0IGN6IGZyb20gJy4vbG9jYWxlL2N6JztcbmltcG9ydCBkYSBmcm9tICcuL2xvY2FsZS9kYSc7XG5pbXBvcnQgZGUgZnJvbSAnLi9sb2NhbGUvZGUnO1xuaW1wb3J0IGVuIGZyb20gJy4vbG9jYWxlL2VuJztcbmltcG9ydCBlbkdCIGZyb20gJy4vbG9jYWxlL2VuLWdiJztcbmltcG9ydCBlcyBmcm9tICcuL2xvY2FsZS9lcyc7XG5pbXBvcnQgZnIgZnJvbSAnLi9sb2NhbGUvZnInO1xuaW1wb3J0IGhpIGZyb20gJy4vbG9jYWxlL2hpJztcbmltcG9ydCBpZCBmcm9tICcuL2xvY2FsZS9pZCc7XG5pbXBvcnQgaXQgZnJvbSAnLi9sb2NhbGUvaXQnO1xuaW1wb3J0IGphIGZyb20gJy4vbG9jYWxlL2phJztcbmltcG9ydCBrbyBmcm9tICcuL2xvY2FsZS9rbyc7XG5pbXBvcnQgbmwgZnJvbSAnLi9sb2NhbGUvbmwnO1xuaW1wb3J0IG5vIGZyb20gJy4vbG9jYWxlL25vJztcbmltcG9ydCBwbCBmcm9tICcuL2xvY2FsZS9wbCc7XG5pbXBvcnQgcHQgZnJvbSAnLi9sb2NhbGUvcHQnO1xuaW1wb3J0IHB0QlIgZnJvbSAnLi9sb2NhbGUvcHQtYnInO1xuaW1wb3J0IHJvIGZyb20gJy4vbG9jYWxlL3JvJztcbmltcG9ydCBydSBmcm9tICcuL2xvY2FsZS9ydSc7XG5pbXBvcnQgdHIgZnJvbSAnLi9sb2NhbGUvdHInO1xuaW1wb3J0IHpoQ04gZnJvbSAnLi9sb2NhbGUvemgtY24nO1xuaW1wb3J0IHpoVFcgZnJvbSAnLi9sb2NhbGUvemgtdHcnO1xuXG5jb25zdCBsb2NhbGVNYXA6IHsgW2s6IHN0cmluZ106IFBhcnRpYWw8dHlwZW9mIGVuPiB9ID0ge1xuICBhcixcbiAgY3M6IGN6LFxuICBkYSxcbiAgZGUsXG4gIGVuLFxuICAnZW4tZ2InOiBlbkdCLFxuICBlcyxcbiAgZnIsXG4gIGhpLFxuICBpZCxcbiAgaXQsXG4gIGphLFxuICBrbyxcbiAgbmwsXG4gIG5uOiBubyxcbiAgcGwsXG4gIHB0LFxuICAncHQtYnInOiBwdEJSLFxuICBybyxcbiAgcnUsXG4gIHRyLFxuICAnemgtY24nOiB6aENOLFxuICAnemgtdHcnOiB6aFRXLFxufTtcblxuY29uc3QgbG9jYWxlID0gbG9jYWxlTWFwW21vbWVudC5sb2NhbGUoKV07XG5cbmV4cG9ydCBmdW5jdGlvbiB0KHN0cjoga2V5b2YgdHlwZW9mIGVuKTogc3RyaW5nIHtcbiAgcmV0dXJuIChsb2NhbGUgJiYgbG9jYWxlW3N0cl0pIHx8IGVuW3N0cl07XG59XG4iLCJpbXBvcnQgeyBub3JtYWxpemVQYXRoLCBOb3RpY2UsIHJlcXVlc3RVcmwgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgcmVsYXRpdmUsIGpvaW4sIHBhcnNlIH0gZnJvbSBcInBhdGgtYnJvd3NlcmlmeVwiO1xuaW1wb3J0IGltYWdlVHlwZSBmcm9tIFwiaW1hZ2UtdHlwZVwiO1xuXG5pbXBvcnQgeyBnZXRVcmxBc3NldCwgdXVpZCB9IGZyb20gXCIuL3V0aWxzXCI7XG5pbXBvcnQgeyB0IH0gZnJvbSBcIi4vbGFuZy9oZWxwZXJzXCI7XG5pbXBvcnQgdHlwZSBpbWFnZUF1dG9VcGxvYWRQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZG93bmxvYWRBbGxJbWFnZUZpbGVzKHBsdWdpbjogaW1hZ2VBdXRvVXBsb2FkUGx1Z2luKSB7XG4gIGNvbnN0IGFjdGl2ZUZpbGUgPSBwbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gIGNvbnN0IGZvbGRlclBhdGggPSBhd2FpdCBwbHVnaW4uYXBwLmZpbGVNYW5hZ2VyLmdldEF2YWlsYWJsZVBhdGhGb3JBdHRhY2htZW50KFxuICAgIFwiXCJcbiAgKTtcblxuICBjb25zdCBmaWxlQXJyYXkgPSBwbHVnaW4uaGVscGVyLmdldEFsbEZpbGVzKCk7XG5cbiAgaWYgKCEoYXdhaXQgcGx1Z2luLmFwcC52YXVsdC5hZGFwdGVyLmV4aXN0cyhmb2xkZXJQYXRoKSkpIHtcbiAgICBhd2FpdCBwbHVnaW4uYXBwLnZhdWx0LmFkYXB0ZXIubWtkaXIoZm9sZGVyUGF0aCk7XG4gIH1cblxuICBsZXQgaW1hZ2VBcnJheSA9IFtdO1xuICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZUFycmF5KSB7XG4gICAgaWYgKCFmaWxlLnBhdGguc3RhcnRzV2l0aChcImh0dHBcIikpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHVybCA9IGZpbGUucGF0aDtcbiAgICBjb25zdCBhc3NldCA9IGdldFVybEFzc2V0KHVybCk7XG4gICAgbGV0IG5hbWUgPSBkZWNvZGVVUkkocGFyc2UoYXNzZXQpLm5hbWUpLnJlcGxhY2VBbGwoL1tcXFxcXFxcXC86Kj9cXFwiPD58XS9nLCBcIi1cIik7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGRvd25sb2FkKHBsdWdpbiwgdXJsLCBmb2xkZXJQYXRoLCBuYW1lKTtcbiAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgIGNvbnN0IGFjdGl2ZUZvbGRlciA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKS5wYXJlbnQucGF0aDtcblxuICAgICAgaW1hZ2VBcnJheS5wdXNoKHtcbiAgICAgICAgc291cmNlOiBmaWxlLnNvdXJjZSxcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgcGF0aDogbm9ybWFsaXplUGF0aChcbiAgICAgICAgICByZWxhdGl2ZShub3JtYWxpemVQYXRoKGFjdGl2ZUZvbGRlciksIG5vcm1hbGl6ZVBhdGgocmVzcG9uc2UucGF0aCkpXG4gICAgICAgICksXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBsZXQgdmFsdWUgPSBwbHVnaW4uaGVscGVyLmdldFZhbHVlKCk7XG4gIGltYWdlQXJyYXkubWFwKGltYWdlID0+IHtcbiAgICBsZXQgbmFtZSA9IHBsdWdpbi5oYW5kbGVOYW1lKGltYWdlLm5hbWUpO1xuXG4gICAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKGltYWdlLnNvdXJjZSwgYCFbJHtuYW1lfV0oJHtlbmNvZGVVUkkoaW1hZ2UucGF0aCl9KWApO1xuICB9KTtcblxuICBjb25zdCBjdXJyZW50RmlsZSA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgaWYgKGFjdGl2ZUZpbGUucGF0aCAhPT0gY3VycmVudEZpbGUucGF0aCkge1xuICAgIG5ldyBOb3RpY2UodChcIkZpbGUgaGFzIGJlZW4gY2hhbmdlZGQsIGRvd25sb2FkIGZhaWx1cmVcIikpO1xuICAgIHJldHVybjtcbiAgfVxuICBwbHVnaW4uaGVscGVyLnNldFZhbHVlKHZhbHVlKTtcblxuICBuZXcgTm90aWNlKFxuICAgIGBhbGw6ICR7ZmlsZUFycmF5Lmxlbmd0aH1cXG5zdWNjZXNzOiAke2ltYWdlQXJyYXkubGVuZ3RofVxcbmZhaWxlZDogJHtcbiAgICAgIGZpbGVBcnJheS5sZW5ndGggLSBpbWFnZUFycmF5Lmxlbmd0aFxuICAgIH1gXG4gICk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRvd25sb2FkKFxuICBwbHVnaW46IGltYWdlQXV0b1VwbG9hZFBsdWdpbixcbiAgdXJsOiBzdHJpbmcsXG4gIGZvbGRlclBhdGg6IHN0cmluZyxcbiAgbmFtZTogc3RyaW5nXG4pIHtcbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHsgdXJsIH0pO1xuXG4gIGlmIChyZXNwb25zZS5zdGF0dXMgIT09IDIwMCkge1xuICAgIHJldHVybiB7XG4gICAgICBvazogZmFsc2UsXG4gICAgICBtc2c6IFwiZXJyb3JcIixcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgdHlwZSA9IGF3YWl0IGltYWdlVHlwZShuZXcgVWludDhBcnJheShyZXNwb25zZS5hcnJheUJ1ZmZlcikpO1xuICBpZiAoIXR5cGUpIHtcbiAgICByZXR1cm4ge1xuICAgICAgb2s6IGZhbHNlLFxuICAgICAgbXNnOiBcImVycm9yXCIsXG4gICAgfTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgbGV0IHBhdGggPSBub3JtYWxpemVQYXRoKGpvaW4oZm9sZGVyUGF0aCwgYCR7bmFtZX0uJHt0eXBlLmV4dH1gKSk7XG5cbiAgICAvLyDlpoLmnpzmlofku7blkI3lt7LlrZjlnKjvvIzliJnnlKjpmo/mnLrlgLzmm7/mjaLvvIzkuI3lr7nmlofku7blkI7nvIDov5vooYzliKTmlq1cbiAgICBpZiAoYXdhaXQgcGx1Z2luLmFwcC52YXVsdC5hZGFwdGVyLmV4aXN0cyhwYXRoKSkge1xuICAgICAgcGF0aCA9IG5vcm1hbGl6ZVBhdGgoam9pbihmb2xkZXJQYXRoLCBgJHt1dWlkKCl9LiR7dHlwZS5leHR9YCkpO1xuICAgIH1cblxuICAgIHBsdWdpbi5hcHAudmF1bHQuYWRhcHRlci53cml0ZUJpbmFyeShwYXRoLCByZXNwb25zZS5hcnJheUJ1ZmZlcik7XG4gICAgcmV0dXJuIHtcbiAgICAgIG9rOiB0cnVlLFxuICAgICAgbXNnOiBcIm9rXCIsXG4gICAgICBwYXRoOiBwYXRoLFxuICAgICAgdHlwZSxcbiAgICB9O1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICByZXR1cm4ge1xuICAgICAgb2s6IGZhbHNlLFxuICAgICAgbXNnOiBlcnIsXG4gICAgfTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgcmVhZEZpbGUgfSBmcm9tIFwiZnNcIjtcblxuaW1wb3J0IHsgUGx1Z2luU2V0dGluZ3MgfSBmcm9tIFwiLi9zZXR0aW5nXCI7XG5pbXBvcnQgeyBzdHJlYW1Ub1N0cmluZywgZ2V0TGFzdEltYWdlLCBidWZmZXJUb0FycmF5QnVmZmVyIH0gZnJvbSBcIi4vdXRpbHNcIjtcbmltcG9ydCB7IGV4ZWMgfSBmcm9tIFwiY2hpbGRfcHJvY2Vzc1wiO1xuaW1wb3J0IHsgcmVxdWVzdFVybCB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IGltYWdlQXV0b1VwbG9hZFBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGljR29SZXNwb25zZSB7XG4gIG1zZzogc3RyaW5nO1xuICByZXN1bHQ6IHN0cmluZ1tdO1xuICBmdWxsUmVzdWx0OiBSZWNvcmQ8c3RyaW5nLCBhbnk+W107XG59XG5cbmV4cG9ydCBjbGFzcyBQaWNHb1VwbG9hZGVyIHtcbiAgc2V0dGluZ3M6IFBsdWdpblNldHRpbmdzO1xuICBwbHVnaW46IGltYWdlQXV0b1VwbG9hZFBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihzZXR0aW5nczogUGx1Z2luU2V0dGluZ3MsIHBsdWdpbjogaW1hZ2VBdXRvVXBsb2FkUGx1Z2luKSB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG5cbiAgYXN5bmMgdXBsb2FkRmlsZXMoZmlsZUxpc3Q6IEFycmF5PHN0cmluZz4pOiBQcm9taXNlPGFueT4ge1xuICAgIGxldCByZXNwb25zZTogYW55O1xuICAgIGxldCBkYXRhOiBQaWNHb1Jlc3BvbnNlO1xuXG4gICAgaWYgKHRoaXMuc2V0dGluZ3MucmVtb3RlU2VydmVyTW9kZSkge1xuICAgICAgY29uc3QgZmlsZXMgPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZmlsZUxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IGZpbGVMaXN0W2ldO1xuICAgICAgICBjb25zdCBidWZmZXI6IEJ1ZmZlciA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICByZWFkRmlsZShmaWxlLCAoZXJyLCBkYXRhKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzb2x2ZShkYXRhKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGFycmF5QnVmZmVyID0gYnVmZmVyVG9BcnJheUJ1ZmZlcihidWZmZXIpO1xuICAgICAgICBmaWxlcy5wdXNoKG5ldyBGaWxlKFthcnJheUJ1ZmZlcl0sIGZpbGUpKTtcbiAgICAgIH1cbiAgICAgIHJlc3BvbnNlID0gYXdhaXQgdGhpcy51cGxvYWRGaWxlQnlEYXRhKGZpbGVzKTtcbiAgICAgIGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7XG4gICAgICAgIHVybDogdGhpcy5zZXR0aW5ncy51cGxvYWRTZXJ2ZXIsXG4gICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICAgIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBsaXN0OiBmaWxlTGlzdCB9KSxcbiAgICAgIH0pO1xuICAgICAgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb247XG4gICAgfVxuXG4gICAgLy8gcGljbGlzdFxuICAgIGlmIChkYXRhLmZ1bGxSZXN1bHQpIHtcbiAgICAgIGNvbnN0IHVwbG9hZFVybEZ1bGxSZXN1bHRMaXN0ID0gZGF0YS5mdWxsUmVzdWx0IHx8IFtdO1xuICAgICAgdGhpcy5zZXR0aW5ncy51cGxvYWRlZEltYWdlcyA9IFtcbiAgICAgICAgLi4uKHRoaXMuc2V0dGluZ3MudXBsb2FkZWRJbWFnZXMgfHwgW10pLFxuICAgICAgICAuLi51cGxvYWRVcmxGdWxsUmVzdWx0TGlzdCxcbiAgICAgIF07XG4gICAgfVxuXG4gICAgcmV0dXJuIGRhdGE7XG4gIH1cblxuICBhc3luYyB1cGxvYWRGaWxlQnlEYXRhKGZpbGVMaXN0OiBGaWxlTGlzdCB8IEZpbGVbXSk6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3QgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZmlsZUxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvcm0uYXBwZW5kKFwibGlzdFwiLCBmaWxlTGlzdFtpXSk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIG1ldGhvZDogXCJwb3N0XCIsXG4gICAgICBib2R5OiBmb3JtLFxuICAgIH07XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHRoaXMuc2V0dGluZ3MudXBsb2FkU2VydmVyLCBvcHRpb25zKTtcbiAgICBjb25zb2xlLmxvZyhcInJlc3BvbnNlXCIsIHJlc3BvbnNlKTtcbiAgICByZXR1cm4gcmVzcG9uc2U7XG4gIH1cblxuICBhc3luYyB1cGxvYWRGaWxlQnlDbGlwYm9hcmQoZmlsZUxpc3Q/OiBGaWxlTGlzdCk6IFByb21pc2U8YW55PiB7XG4gICAgbGV0IGRhdGE6IFBpY0dvUmVzcG9uc2U7XG4gICAgbGV0IHJlczogYW55O1xuXG4gICAgaWYgKHRoaXMuc2V0dGluZ3MucmVtb3RlU2VydmVyTW9kZSkge1xuICAgICAgcmVzID0gYXdhaXQgdGhpcy51cGxvYWRGaWxlQnlEYXRhKGZpbGVMaXN0KTtcbiAgICAgIGRhdGEgPSBhd2FpdCByZXMuanNvbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXMgPSBhd2FpdCByZXF1ZXN0VXJsKHtcbiAgICAgICAgdXJsOiB0aGlzLnNldHRpbmdzLnVwbG9hZFNlcnZlcixcbiAgICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIH0pO1xuXG4gICAgICBkYXRhID0gYXdhaXQgcmVzLmpzb247XG4gICAgfVxuXG4gICAgaWYgKHJlcy5zdGF0dXMgIT09IDIwMCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY29kZTogLTEsXG4gICAgICAgIG1zZzogZGF0YS5tc2csXG4gICAgICAgIGRhdGE6IFwiXCIsXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIHBpY2xpc3RcbiAgICBpZiAoZGF0YS5mdWxsUmVzdWx0KSB7XG4gICAgICBjb25zdCB1cGxvYWRVcmxGdWxsUmVzdWx0TGlzdCA9IGRhdGEuZnVsbFJlc3VsdCB8fCBbXTtcbiAgICAgIHRoaXMuc2V0dGluZ3MudXBsb2FkZWRJbWFnZXMgPSBbXG4gICAgICAgIC4uLih0aGlzLnNldHRpbmdzLnVwbG9hZGVkSW1hZ2VzIHx8IFtdKSxcbiAgICAgICAgLi4udXBsb2FkVXJsRnVsbFJlc3VsdExpc3QsXG4gICAgICBdO1xuICAgICAgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvZGU6IDAsXG4gICAgICBtc2c6IFwic3VjY2Vzc1wiLFxuICAgICAgZGF0YTogdHlwZW9mIGRhdGEucmVzdWx0ID09IFwic3RyaW5nXCIgPyBkYXRhLnJlc3VsdCA6IGRhdGEucmVzdWx0WzBdLFxuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBpY0dvQ29yZVVwbG9hZGVyIHtcbiAgc2V0dGluZ3M6IFBsdWdpblNldHRpbmdzO1xuICBwbHVnaW46IGltYWdlQXV0b1VwbG9hZFBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihzZXR0aW5nczogUGx1Z2luU2V0dGluZ3MsIHBsdWdpbjogaW1hZ2VBdXRvVXBsb2FkUGx1Z2luKSB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICB9XG5cbiAgYXN5bmMgdXBsb2FkRmlsZXMoZmlsZUxpc3Q6IEFycmF5PFN0cmluZz4pOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IGxlbmd0aCA9IGZpbGVMaXN0Lmxlbmd0aDtcbiAgICBsZXQgY2xpID0gdGhpcy5zZXR0aW5ncy5waWNnb0NvcmVQYXRoIHx8IFwicGljZ29cIjtcbiAgICBsZXQgY29tbWFuZCA9IGAke2NsaX0gdXBsb2FkICR7ZmlsZUxpc3RcbiAgICAgIC5tYXAoaXRlbSA9PiBgXCIke2l0ZW19XCJgKVxuICAgICAgLmpvaW4oXCIgXCIpfWA7XG5cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLmV4ZWMoY29tbWFuZCk7XG4gICAgY29uc3Qgc3BsaXRMaXN0ID0gcmVzLnNwbGl0KFwiXFxuXCIpO1xuICAgIGNvbnN0IHNwbGl0TGlzdExlbmd0aCA9IHNwbGl0TGlzdC5sZW5ndGg7XG5cbiAgICBjb25zdCBkYXRhID0gc3BsaXRMaXN0LnNwbGljZShzcGxpdExpc3RMZW5ndGggLSAxIC0gbGVuZ3RoLCBsZW5ndGgpO1xuXG4gICAgaWYgKHJlcy5pbmNsdWRlcyhcIlBpY0dvIEVSUk9SXCIpKSB7XG4gICAgICBjb25zb2xlLmxvZyhjb21tYW5kLCByZXMpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgbXNnOiBcIuWksei0pVwiLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgcmVzdWx0OiBkYXRhLFxuICAgICAgfTtcbiAgICB9XG4gICAgLy8ge3N1Y2Nlc3M6dHJ1ZSxyZXN1bHQ6W119XG4gIH1cblxuICAvLyBQaWNHby1Db3JlIOS4iuS8oOWkhOeQhlxuICBhc3luYyB1cGxvYWRGaWxlQnlDbGlwYm9hcmQoKSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy51cGxvYWRCeUNsaXAoKTtcbiAgICBjb25zdCBzcGxpdExpc3QgPSByZXMuc3BsaXQoXCJcXG5cIik7XG4gICAgY29uc3QgbGFzdEltYWdlID0gZ2V0TGFzdEltYWdlKHNwbGl0TGlzdCk7XG5cbiAgICBpZiAobGFzdEltYWdlKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjb2RlOiAwLFxuICAgICAgICBtc2c6IFwic3VjY2Vzc1wiLFxuICAgICAgICBkYXRhOiBsYXN0SW1hZ2UsXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zb2xlLmxvZyhzcGxpdExpc3QpO1xuXG4gICAgICAvLyBuZXcgTm90aWNlKGBcIlBsZWFzZSBjaGVjayBQaWNHby1Db3JlIGNvbmZpZ1wiXFxuJHtyZXN9YCk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjb2RlOiAtMSxcbiAgICAgICAgbXNnOiBgXCJQbGVhc2UgY2hlY2sgUGljR28tQ29yZSBjb25maWdcIlxcbiR7cmVzfWAsXG4gICAgICAgIGRhdGE6IFwiXCIsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIC8vIFBpY0dvLUNvcmXnmoTliarliIfkuIrkvKDlj43ppohcbiAgYXN5bmMgdXBsb2FkQnlDbGlwKCkge1xuICAgIGxldCBjb21tYW5kO1xuICAgIGlmICh0aGlzLnNldHRpbmdzLnBpY2dvQ29yZVBhdGgpIHtcbiAgICAgIGNvbW1hbmQgPSBgJHt0aGlzLnNldHRpbmdzLnBpY2dvQ29yZVBhdGh9IHVwbG9hZGA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbW1hbmQgPSBgcGljZ28gdXBsb2FkYDtcbiAgICB9XG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5leGVjKGNvbW1hbmQpO1xuICAgIC8vIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuc3Bhd25DaGlsZCgpO1xuXG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIGFzeW5jIGV4ZWMoY29tbWFuZDogc3RyaW5nKSB7XG4gICAgbGV0IHsgc3Rkb3V0IH0gPSBhd2FpdCBleGVjKGNvbW1hbmQpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHN0cmVhbVRvU3RyaW5nKHN0ZG91dCk7XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIGFzeW5jIHNwYXduQ2hpbGQoKSB7XG4gICAgY29uc3QgeyBzcGF3biB9ID0gcmVxdWlyZShcImNoaWxkX3Byb2Nlc3NcIik7XG4gICAgY29uc3QgY2hpbGQgPSBzcGF3bihcInBpY2dvXCIsIFtcInVwbG9hZFwiXSwge1xuICAgICAgc2hlbGw6IHRydWUsXG4gICAgfSk7XG5cbiAgICBsZXQgZGF0YSA9IFwiXCI7XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiBjaGlsZC5zdGRvdXQpIHtcbiAgICAgIGRhdGEgKz0gY2h1bms7XG4gICAgfVxuICAgIGxldCBlcnJvciA9IFwiXCI7XG4gICAgZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiBjaGlsZC5zdGRlcnIpIHtcbiAgICAgIGVycm9yICs9IGNodW5rO1xuICAgIH1cbiAgICBjb25zdCBleGl0Q29kZSA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNoaWxkLm9uKFwiY2xvc2VcIiwgcmVzb2x2ZSk7XG4gICAgfSk7XG5cbiAgICBpZiAoZXhpdENvZGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgc3VicHJvY2VzcyBlcnJvciBleGl0ICR7ZXhpdENvZGV9LCAke2Vycm9yfWApO1xuICAgIH1cbiAgICByZXR1cm4gZGF0YTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgSVN0cmluZ0tleU1hcCB9IGZyb20gXCIuL3V0aWxzXCI7XG5pbXBvcnQgeyBBcHAsIHJlcXVlc3RVcmwgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCBpbWFnZUF1dG9VcGxvYWRQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuXG5leHBvcnQgY2xhc3MgUGljR29EZWxldGVyIHtcbiAgcGx1Z2luOiBpbWFnZUF1dG9VcGxvYWRQbHVnaW47XG5cbiAgY29uc3RydWN0b3IocGx1Z2luOiBpbWFnZUF1dG9VcGxvYWRQbHVnaW4pIHtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGFzeW5jIGRlbGV0ZUltYWdlKGNvbmZpZ01hcDogSVN0cmluZ0tleU1hcDxhbnk+W10pIHtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoe1xuICAgICAgdXJsOiB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWxldGVTZXJ2ZXIsXG4gICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9LFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBsaXN0OiBjb25maWdNYXAsXG4gICAgICB9KSxcbiAgICB9KTtcbiAgICBjb25zdCBkYXRhID0gcmVzcG9uc2UuanNvbjtcbiAgICByZXR1cm4gZGF0YTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgTWFya2Rvd25WaWV3LCBBcHAgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IHBhcnNlIH0gZnJvbSBcInBhdGgtYnJvd3NlcmlmeVwiO1xuXG5pbnRlcmZhY2UgSW1hZ2Uge1xuICBwYXRoOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgc291cmNlOiBzdHJpbmc7XG59XG4vLyAhW10oLi9kc2EvYWEucG5nKSBsb2NhbCBpbWFnZSBzaG91bGQgaGFzIGV4dCwgc3VwcG9ydCAhW10oPC4vZHNhL2FhLnBuZz4pLCBzdXBwb3J0ICFbXShpbWFnZS5wbmcgXCJhbHRcIilcbi8vICFbXShodHRwczovL2Rhc2Rhc2RhKSBpbnRlcm5ldCBpbWFnZSBzaG91bGQgbm90IGhhcyBleHRcbmNvbnN0IFJFR0VYX0ZJTEUgPVxuICAvXFwhXFxbKC4qPylcXF1cXCg8KFxcUytcXC5cXHcrKT5cXCl8XFwhXFxbKC4qPylcXF1cXCgoXFxTK1xcLlxcdyspKD86XFxzK1wiW15cIl0qXCIpP1xcKXxcXCFcXFsoLio/KVxcXVxcKChodHRwcz86XFwvXFwvLio/KVxcKS9nO1xuY29uc3QgUkVHRVhfV0lLSV9GSUxFID0gL1xcIVxcW1xcWyguKj8pKFxccyo/XFx8Lio/KT9cXF1cXF0vZztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgSGVscGVyIHtcbiAgYXBwOiBBcHA7XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHApIHtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgfVxuXG4gIGdldEZyb250bWF0dGVyVmFsdWUoa2V5OiBzdHJpbmcsIGRlZmF1bHRWYWx1ZTogYW55ID0gdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgaWYgKCFmaWxlKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBjb25zdCBwYXRoID0gZmlsZS5wYXRoO1xuICAgIGNvbnN0IGNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRDYWNoZShwYXRoKTtcblxuICAgIGxldCB2YWx1ZSA9IGRlZmF1bHRWYWx1ZTtcbiAgICBpZiAoY2FjaGU/LmZyb250bWF0dGVyICYmIGNhY2hlLmZyb250bWF0dGVyLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgIHZhbHVlID0gY2FjaGUuZnJvbnRtYXR0ZXJba2V5XTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgZ2V0RWRpdG9yKCkge1xuICAgIGNvbnN0IG1kVmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XG4gICAgaWYgKG1kVmlldykge1xuICAgICAgcmV0dXJuIG1kVmlldy5lZGl0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGdldFZhbHVlKCkge1xuICAgIGNvbnN0IGVkaXRvciA9IHRoaXMuZ2V0RWRpdG9yKCk7XG4gICAgcmV0dXJuIGVkaXRvci5nZXRWYWx1ZSgpO1xuICB9XG5cbiAgc2V0VmFsdWUodmFsdWU6IHN0cmluZykge1xuICAgIGNvbnN0IGVkaXRvciA9IHRoaXMuZ2V0RWRpdG9yKCk7XG4gICAgY29uc3QgeyBsZWZ0LCB0b3AgfSA9IGVkaXRvci5nZXRTY3JvbGxJbmZvKCk7XG4gICAgY29uc3QgcG9zaXRpb24gPSBlZGl0b3IuZ2V0Q3Vyc29yKCk7XG5cbiAgICBlZGl0b3Iuc2V0VmFsdWUodmFsdWUpO1xuICAgIGVkaXRvci5zY3JvbGxUbyhsZWZ0LCB0b3ApO1xuICAgIGVkaXRvci5zZXRDdXJzb3IocG9zaXRpb24pO1xuICB9XG5cbiAgLy8gZ2V0IGFsbCBmaWxlIHVybHMsIGluY2x1ZGUgbG9jYWwgYW5kIGludGVybmV0XG4gIGdldEFsbEZpbGVzKCk6IEltYWdlW10ge1xuICAgIGNvbnN0IGVkaXRvciA9IHRoaXMuZ2V0RWRpdG9yKCk7XG4gICAgbGV0IHZhbHVlID0gZWRpdG9yLmdldFZhbHVlKCk7XG4gICAgcmV0dXJuIHRoaXMuZ2V0SW1hZ2VMaW5rKHZhbHVlKTtcbiAgfVxuXG4gIGdldEltYWdlTGluayh2YWx1ZTogc3RyaW5nKTogSW1hZ2VbXSB7XG4gICAgY29uc3QgbWF0Y2hlcyA9IHZhbHVlLm1hdGNoQWxsKFJFR0VYX0ZJTEUpO1xuICAgIGNvbnN0IFdpa2lNYXRjaGVzID0gdmFsdWUubWF0Y2hBbGwoUkVHRVhfV0lLSV9GSUxFKTtcblxuICAgIGxldCBmaWxlQXJyYXk6IEltYWdlW10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgbWF0Y2ggb2YgbWF0Y2hlcykge1xuICAgICAgY29uc3Qgc291cmNlID0gbWF0Y2hbMF07XG5cbiAgICAgIGxldCBuYW1lID0gbWF0Y2hbMV07XG4gICAgICBsZXQgcGF0aCA9IG1hdGNoWzJdO1xuICAgICAgaWYgKG5hbWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBuYW1lID0gbWF0Y2hbM107XG4gICAgICB9XG4gICAgICBpZiAocGF0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHBhdGggPSBtYXRjaFs0XTtcbiAgICAgIH1cblxuICAgICAgZmlsZUFycmF5LnB1c2goe1xuICAgICAgICBwYXRoOiBwYXRoLFxuICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICBzb3VyY2U6IHNvdXJjZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgbWF0Y2ggb2YgV2lraU1hdGNoZXMpIHtcbiAgICAgIGxldCBuYW1lID0gcGFyc2UobWF0Y2hbMV0pLm5hbWU7XG4gICAgICBjb25zdCBwYXRoID0gbWF0Y2hbMV07XG4gICAgICBjb25zdCBzb3VyY2UgPSBtYXRjaFswXTtcbiAgICAgIGlmIChtYXRjaFsyXSkge1xuICAgICAgICBuYW1lID0gYCR7bmFtZX0ke21hdGNoWzJdfWA7XG4gICAgICB9XG4gICAgICBmaWxlQXJyYXkucHVzaCh7XG4gICAgICAgIHBhdGg6IHBhdGgsXG4gICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgIHNvdXJjZTogc291cmNlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZpbGVBcnJheTtcbiAgfVxuXG4gIGhhc0JsYWNrRG9tYWluKHNyYzogc3RyaW5nLCBibGFja0RvbWFpbnM6IHN0cmluZykge1xuICAgIGlmIChibGFja0RvbWFpbnMudHJpbSgpID09PSBcIlwiKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGNvbnN0IGJsYWNrRG9tYWluTGlzdCA9IGJsYWNrRG9tYWlucy5zcGxpdChcIixcIikuZmlsdGVyKGl0ZW0gPT4gaXRlbSAhPT0gXCJcIik7XG4gICAgbGV0IHVybCA9IG5ldyBVUkwoc3JjKTtcbiAgICBjb25zdCBkb21haW4gPSB1cmwuaG9zdG5hbWU7XG5cbiAgICByZXR1cm4gYmxhY2tEb21haW5MaXN0LnNvbWUoYmxhY2tEb21haW4gPT4gZG9tYWluLmluY2x1ZGVzKGJsYWNrRG9tYWluKSk7XG4gIH1cbn1cbiIsImltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZywgTm90aWNlIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgaW1hZ2VBdXRvVXBsb2FkUGx1Z2luIGZyb20gXCIuL21haW5cIjtcbmltcG9ydCB7IHQgfSBmcm9tIFwiLi9sYW5nL2hlbHBlcnNcIjtcbmltcG9ydCB7IGdldE9TIH0gZnJvbSBcIi4vdXRpbHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQbHVnaW5TZXR0aW5ncyB7XG4gIHVwbG9hZEJ5Q2xpcFN3aXRjaDogYm9vbGVhbjtcbiAgdXBsb2FkU2VydmVyOiBzdHJpbmc7XG4gIGRlbGV0ZVNlcnZlcjogc3RyaW5nO1xuICBpbWFnZVNpemVTdWZmaXg6IHN0cmluZztcbiAgdXBsb2FkZXI6IHN0cmluZztcbiAgcGljZ29Db3JlUGF0aDogc3RyaW5nO1xuICB3b3JrT25OZXRXb3JrOiBib29sZWFuO1xuICBuZXdXb3JrQmxhY2tEb21haW5zOiBzdHJpbmc7XG4gIGZpeFBhdGg6IGJvb2xlYW47XG4gIGFwcGx5SW1hZ2U6IGJvb2xlYW47XG4gIGRlbGV0ZVNvdXJjZTogYm9vbGVhbjtcbiAgYXV0b0NsZWFudXBSb290OiBib29sZWFuO1xuICBpbWFnZURlc2M6IFwib3JpZ2luXCIgfCBcIm5vbmVcIiB8IFwicmVtb3ZlRGVmYXVsdFwiO1xuICByZW1vdGVTZXJ2ZXJNb2RlOiBib29sZWFuO1xuICBhdXRvVXBkYXRlOiBib29sZWFuO1xuICBbcHJvcE5hbWU6IHN0cmluZ106IGFueTtcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IFBsdWdpblNldHRpbmdzID0ge1xuICB1cGxvYWRCeUNsaXBTd2l0Y2g6IHRydWUsXG4gIHVwbG9hZGVyOiBcIlBpY0dvXCIsXG4gIHVwbG9hZFNlcnZlcjogXCJodHRwOi8vMTI3LjAuMC4xOjM2Njc3L3VwbG9hZFwiLFxuICBkZWxldGVTZXJ2ZXI6IFwiaHR0cDovLzEyNy4wLjAuMTozNjY3Ny9kZWxldGVcIixcbiAgaW1hZ2VTaXplU3VmZml4OiBcIlwiLFxuICBwaWNnb0NvcmVQYXRoOiBcIlwiLFxuICB3b3JrT25OZXRXb3JrOiBmYWxzZSxcbiAgZml4UGF0aDogZmFsc2UsXG4gIGFwcGx5SW1hZ2U6IHRydWUsXG4gIG5ld1dvcmtCbGFja0RvbWFpbnM6IFwiXCIsXG4gIGRlbGV0ZVNvdXJjZTogZmFsc2UsXG4gIGF1dG9DbGVhbnVwUm9vdDogdHJ1ZSxcbiAgaW1hZ2VEZXNjOiBcIm9yaWdpblwiLFxuICByZW1vdGVTZXJ2ZXJNb2RlOiBmYWxzZSxcbiAgYXV0b1VwZGF0ZTogdHJ1ZSxcbn07XG5cbmV4cG9ydCBjbGFzcyBTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIHBsdWdpbjogaW1hZ2VBdXRvVXBsb2FkUGx1Z2luO1xuICBwcml2YXRlIGlzQ2hlY2tpbmdVcGRhdGUgPSBmYWxzZTtcbiAgcHJpdmF0ZSBpc1VwZGF0aW5nID0gZmFsc2U7XG4gIHByaXZhdGUgdXBkYXRlUHJvZ3Jlc3MgPSAwO1xuICBwcml2YXRlIHVwZGF0ZVJlc3VsdE1lc3NhZ2UgPSBcIlwiO1xuICBwcml2YXRlIGxhdGVzdFZlcnNpb24gPSBcIlwiO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IGltYWdlQXV0b1VwbG9hZFBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgbGV0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cbiAgICBjb25zdCBvcyA9IGdldE9TKCk7XG5cbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiB0KFwiUGx1Z2luIFNldHRpbmdzXCIpIH0pO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUodChcIkF1dG8gcGFzdGVkIHVwbG9hZFwiKSlcbiAgICAgIC5zZXREZXNjKFxuICAgICAgICB0KFxuICAgICAgICAgIFwiSWYgeW91IHNldCB0aGlzIHZhbHVlIHRydWUsIHdoZW4geW91IHBhc3RlIGltYWdlLCBpdCB3aWxsIGJlIGF1dG8gdXBsb2FkZWQoeW91IHNob3VsZCBzZXQgdGhlIHBpY0dvIHNlcnZlciByaWdodGx5KVwiXG4gICAgICAgIClcbiAgICAgIClcbiAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy51cGxvYWRCeUNsaXBTd2l0Y2gpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jIHZhbHVlID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnVwbG9hZEJ5Q2xpcFN3aXRjaCA9IHZhbHVlO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKHQoXCJEZWZhdWx0IHVwbG9hZGVyXCIpKVxuICAgICAgLnNldERlc2ModChcIkRlZmF1bHQgdXBsb2FkZXJcIikpXG4gICAgICAuYWRkRHJvcGRvd24oY2IgPT5cbiAgICAgICAgY2JcbiAgICAgICAgICAuYWRkT3B0aW9uKFwiUGljR29cIiwgXCJQaWNHbyhhcHApXCIpXG4gICAgICAgICAgLmFkZE9wdGlvbihcIlBpY0dvLUNvcmVcIiwgXCJQaWNHby1Db3JlXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnVwbG9hZGVyKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyB2YWx1ZSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy51cGxvYWRlciA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5kaXNwbGF5KCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy51cGxvYWRlciA9PT0gXCJQaWNHb1wiKSB7XG4gICAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgICAgLnNldE5hbWUodChcIlBpY0dvIHNlcnZlclwiKSlcbiAgICAgICAgLnNldERlc2ModChcIlBpY0dvIHNlcnZlciBkZXNjXCIpKVxuICAgICAgICAuYWRkVGV4dCh0ZXh0ID0+XG4gICAgICAgICAgdGV4dFxuICAgICAgICAgICAgLnNldFBsYWNlaG9sZGVyKHQoXCJQbGVhc2UgaW5wdXQgUGljR28gc2VydmVyXCIpKVxuICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnVwbG9hZFNlcnZlcilcbiAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyBrZXkgPT4ge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy51cGxvYWRTZXJ2ZXIgPSBrZXk7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgKTtcblxuICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgIC5zZXROYW1lKHQoXCJQaWNHbyBkZWxldGUgc2VydmVyXCIpKVxuICAgICAgICAuc2V0RGVzYyh0KFwiUGljTGlzdCBkZXNjXCIpKVxuICAgICAgICAuYWRkVGV4dCh0ZXh0ID0+XG4gICAgICAgICAgdGV4dFxuICAgICAgICAgICAgLnNldFBsYWNlaG9sZGVyKHQoXCJQbGVhc2UgaW5wdXQgUGljR28gZGVsZXRlIHNlcnZlclwiKSlcbiAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWxldGVTZXJ2ZXIpXG4gICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMga2V5ID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVsZXRlU2VydmVyID0ga2V5O1xuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSh0KFwiUmVtb3RlIHNlcnZlciBtb2RlXCIpKVxuICAgICAgLnNldERlc2ModChcIlJlbW90ZSBzZXJ2ZXIgbW9kZSBkZXNjXCIpKVxuICAgICAgLmFkZFRvZ2dsZSh0b2dnbGUgPT5cbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnJlbW90ZVNlcnZlck1vZGUpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jIHZhbHVlID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnJlbW90ZVNlcnZlck1vZGUgPSB2YWx1ZTtcbiAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy53b3JrT25OZXRXb3JrID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmRpc3BsYXkoKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgaWYgKHRoaXMucGx1Z2luLnNldHRpbmdzLnVwbG9hZGVyID09PSBcIlBpY0dvLUNvcmVcIikge1xuICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgIC5zZXROYW1lKHQoXCJQaWNHby1Db3JlIHBhdGhcIikpXG4gICAgICAgIC5zZXREZXNjKFxuICAgICAgICAgIHQoXCJQbGVhc2UgaW5wdXQgUGljR28tQ29yZSBwYXRoLCBkZWZhdWx0IHVzaW5nIGVudmlyb25tZW50IHZhcmlhYmxlc1wiKVxuICAgICAgICApXG4gICAgICAgIC5hZGRUZXh0KHRleHQgPT5cbiAgICAgICAgICB0ZXh0XG4gICAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCJcIilcbiAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5waWNnb0NvcmVQYXRoKVxuICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jIHZhbHVlID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucGljZ29Db3JlUGF0aCA9IHZhbHVlO1xuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICk7XG5cbiAgICAgIGlmIChvcyAhPT0gXCJXaW5kb3dzXCIpIHtcbiAgICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgICAgLnNldE5hbWUodChcImZpeFBhdGhcIikpXG4gICAgICAgICAgLnNldERlc2ModChcImZpeFBhdGhXYXJuaW5nXCIpKVxuICAgICAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+XG4gICAgICAgICAgICB0b2dnbGVcbiAgICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmZpeFBhdGgpXG4gICAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyB2YWx1ZSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZml4UGF0aCA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gaW1hZ2UgZGVzYyBzZXR0aW5nXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSh0KFwiSW1hZ2UgZGVzY1wiKSlcbiAgICAgIC5zZXREZXNjKHQoXCJJbWFnZSBkZXNjXCIpKVxuICAgICAgLmFkZERyb3Bkb3duKGNiID0+XG4gICAgICAgIGNiXG4gICAgICAgICAgLmFkZE9wdGlvbihcIm9yaWdpblwiLCB0KFwicmVzZXJ2ZVwiKSkgLy8g5L+d55WZ5YWo6YOoXG4gICAgICAgICAgLmFkZE9wdGlvbihcIm5vbmVcIiwgdChcInJlbW92ZSBhbGxcIikpIC8vIOenu+mZpOWFqOmDqFxuICAgICAgICAgIC5hZGRPcHRpb24oXCJyZW1vdmVEZWZhdWx0XCIsIHQoXCJyZW1vdmUgZGVmYXVsdFwiKSkgLy8g5Y+q56e76Zmk6buY6K6k5Y2zIGltYWdlLnBuZ1xuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbWFnZURlc2MpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZTogXCJvcmlnaW5cIiB8IFwibm9uZVwiIHwgXCJyZW1vdmVEZWZhdWx0XCIpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmltYWdlRGVzYyA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5kaXNwbGF5KCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUodChcIkltYWdlIHNpemUgc3VmZml4XCIpKVxuICAgICAgLnNldERlc2ModChcIkltYWdlIHNpemUgc3VmZml4IERlc2NyaXB0aW9uXCIpKVxuICAgICAgLmFkZFRleHQodGV4dCA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKHQoXCJQbGVhc2UgaW5wdXQgaW1hZ2Ugc2l6ZSBzdWZmaXhcIikpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmltYWdlU2l6ZVN1ZmZpeClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMga2V5ID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmltYWdlU2l6ZVN1ZmZpeCA9IGtleTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSh0KFwiV29yayBvbiBuZXR3b3JrXCIpKVxuICAgICAgLnNldERlc2ModChcIldvcmsgb24gbmV0d29yayBEZXNjcmlwdGlvblwiKSlcbiAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy53b3JrT25OZXRXb3JrKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyB2YWx1ZSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MucmVtb3RlU2VydmVyTW9kZSkge1xuICAgICAgICAgICAgICBuZXcgTm90aWNlKFwiQ2FuIG9ubHkgd29yayB3aGVuIHJlbW90ZSBzZXJ2ZXIgbW9kZSBpcyBvZmYuXCIpO1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy53b3JrT25OZXRXb3JrID0gZmFsc2U7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy53b3JrT25OZXRXb3JrID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmRpc3BsYXkoKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSh0KFwiTmV0d29yayBEb21haW4gQmxhY2sgTGlzdFwiKSlcbiAgICAgIC5zZXREZXNjKHQoXCJOZXR3b3JrIERvbWFpbiBCbGFjayBMaXN0IERlc2NyaXB0aW9uXCIpKVxuICAgICAgLmFkZFRleHRBcmVhKHRleHRBcmVhID0+XG4gICAgICAgIHRleHRBcmVhXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm5ld1dvcmtCbGFja0RvbWFpbnMpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jIHZhbHVlID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLm5ld1dvcmtCbGFja0RvbWFpbnMgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSh0KFwiVXBsb2FkIHdoZW4gY2xpcGJvYXJkIGhhcyBpbWFnZSBhbmQgdGV4dCB0b2dldGhlclwiKSlcbiAgICAgIC5zZXREZXNjKFxuICAgICAgICB0KFxuICAgICAgICAgIFwiV2hlbiB5b3UgY29weSwgc29tZSBhcHBsaWNhdGlvbiBsaWtlIEV4Y2VsIHdpbGwgaW1hZ2UgYW5kIHRleHQgdG8gY2xpcGJvYXJkLCB5b3UgY2FuIHVwbG9hZCBvciBub3QuXCJcbiAgICAgICAgKVxuICAgICAgKVxuICAgICAgLmFkZFRvZ2dsZSh0b2dnbGUgPT5cbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFwcGx5SW1hZ2UpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jIHZhbHVlID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmFwcGx5SW1hZ2UgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGxheSgpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKHQoXCJEZWxldGUgc291cmNlIGZpbGUgYWZ0ZXIgeW91IHVwbG9hZCBmaWxlXCIpKVxuICAgICAgLnNldERlc2ModChcIkRlbGV0ZSBzb3VyY2UgZmlsZSBpbiBvYiBhc3NldHMgYWZ0ZXIgeW91IHVwbG9hZCBmaWxlLlwiKSlcbiAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWxldGVTb3VyY2UpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jIHZhbHVlID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmRlbGV0ZVNvdXJjZSA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5kaXNwbGF5KCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCLoh6rliqjmuIXnkIbmoLnnm67lvZXpmYTku7ZcIilcbiAgICAgIC5zZXREZXNjKFwi5q+PIDMwIOWIhumSn+aJq+aPj+agueebruW9leS4reeahOWbvueJh+WSjOmfs+inhumikeaWh+S7tu+8jOS4iuS8oOWQjuabv+aNoumTvuaOpeW5tuWIoOmZpOacrOWcsOa6kOaWh+S7tuOAglwiKVxuICAgICAgLmFkZEJ1dHRvbihidXR0b24gPT5cbiAgICAgICAgYnV0dG9uLnNldEJ1dHRvblRleHQoXCLnq4vljbPmiafooYxcIikub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uY2xlYW51cFJvb3RBc3NldHNXaXRoTm90aWNlKCk7XG4gICAgICAgIH0pXG4gICAgICApXG4gICAgICAuYWRkVG9nZ2xlKHRvZ2dsZSA9PlxuICAgICAgICB0b2dnbGVcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b0NsZWFudXBSb290KVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyB2YWx1ZSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvQ2xlYW51cFJvb3QgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgdGhpcy5yZW5kZXJWZXJzaW9uVXBkYXRlU2VjdGlvbihjb250YWluZXJFbCk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlclZlcnNpb25VcGRhdGVTZWN0aW9uKGNvbnRhaW5lckVsOiBIVE1MRWxlbWVudCkge1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIueJiOacrOabtOaWsFwiIH0pO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBcImZpbGUtYXV0by11cGxvYWQtcGx1Z2luXCIgfSk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRGl2KHtcbiAgICAgIGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFib3V0LXZlcnNpb25cIixcbiAgICAgIHRleHQ6IGDlvZPliY3niYjmnKzvvJoke3RoaXMucGx1Z2luLm1hbmlmZXN0LnZlcnNpb259YCxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFjdGlvbkVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWJvdXQtYWN0aW9uXCIgfSk7XG4gICAgY29uc3QgY2hlY2tCdXR0b24gPSBhY3Rpb25FbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7XG4gICAgICBjbHM6IFwibW9kLWN0YSBhdXRvLWZyb250bWF0dGVyLWFib3V0LWNoZWNrLWJ0blwiLFxuICAgICAgdGV4dDogdGhpcy5pc0NoZWNraW5nVXBkYXRlID8gXCLmo4Dmn6XkuK0uLi5cIiA6IFwi5qOA5p+l5pu05pawXCIsXG4gICAgfSk7XG4gICAgY2hlY2tCdXR0b24uZGlzYWJsZWQgPSB0aGlzLmlzQ2hlY2tpbmdVcGRhdGUgfHwgdGhpcy5pc1VwZGF0aW5nO1xuICAgIGNoZWNrQnV0dG9uLm9uY2xpY2sgPSBhc3luYyAoKSA9PiB7XG4gICAgICB0aGlzLmlzQ2hlY2tpbmdVcGRhdGUgPSB0cnVlO1xuICAgICAgdGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlID0gXCJcIjtcbiAgICAgIHRoaXMubGF0ZXN0VmVyc2lvbiA9IFwiXCI7XG4gICAgICB0aGlzLmRpc3BsYXkoKTtcblxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wbHVnaW4uY2hlY2tGb3JVcGRhdGUoKTtcbiAgICAgIHRoaXMuaXNDaGVja2luZ1VwZGF0ZSA9IGZhbHNlO1xuXG4gICAgICBpZiAocmVzdWx0LmVycm9yID09PSBcIm5vdF9mb3VuZFwiKSB7XG4gICAgICAgIG5ldyBOb3RpY2UoXCLmnKrmib7liLDov5znq6/ku5PlupPvvIzor7fmo4Dmn6XnvZHnu5xcIik7XG4gICAgICAgIHRoaXMudXBkYXRlUmVzdWx0TWVzc2FnZSA9IFwi5pyq5om+5Yiw6L+c56uv5LuT5bqT77yM6K+35qOA5p+l572R57ucXCI7XG4gICAgICB9IGVsc2UgaWYgKHJlc3VsdC5lcnJvcikge1xuICAgICAgICBuZXcgTm90aWNlKHJlc3VsdC5lcnJvcik7XG4gICAgICAgIHRoaXMudXBkYXRlUmVzdWx0TWVzc2FnZSA9IHJlc3VsdC5lcnJvcjtcbiAgICAgIH0gZWxzZSBpZiAocmVzdWx0Lmhhc1VwZGF0ZSkge1xuICAgICAgICB0aGlzLmxhdGVzdFZlcnNpb24gPSByZXN1bHQudmVyc2lvbjtcbiAgICAgICAgdGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlID0gYPCflIQg5Y+R546w5paw54mI5pys77yaJHtyZXN1bHQudmVyc2lvbn3vvIjlvZPliY0gJHt0aGlzLnBsdWdpbi5tYW5pZmVzdC52ZXJzaW9ufe+8iWA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UgPSBg4pyFIOW9k+WJjeW3suaYr+acgOaWsOeJiOacrO+8iCR7dGhpcy5wbHVnaW4ubWFuaWZlc3QudmVyc2lvbn3vvIlgO1xuICAgICAgfVxuICAgICAgdGhpcy5kaXNwbGF5KCk7XG4gICAgfTtcblxuICAgIGlmICh0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UpIHtcbiAgICAgIGNvbnN0IHJlc3VsdEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcImF1dG8tZnJvbnRtYXR0ZXItYWJvdXQtcmVzdWx0XCIgfSk7XG4gICAgICByZXN1bHRFbC5jcmVhdGVEaXYoeyB0ZXh0OiB0aGlzLnVwZGF0ZVJlc3VsdE1lc3NhZ2UgfSk7XG5cbiAgICAgIGlmICh0aGlzLmxhdGVzdFZlcnNpb24pIHtcbiAgICAgICAgY29uc3QgdXBkYXRlQnV0dG9uID0gcmVzdWx0RWwuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICAgIGNsczogXCJtb2QtY3RhIGF1dG8tZnJvbnRtYXR0ZXItYWJvdXQtdXBkYXRlLWJ0blwiLFxuICAgICAgICAgIHRleHQ6IHRoaXMuaXNVcGRhdGluZyA/IGDmm7TmlrDkuK0uLi7vvIgke3RoaXMudXBkYXRlUHJvZ3Jlc3N9LzPvvIlgIDogXCLnq4vljbPmm7TmlrBcIixcbiAgICAgICAgfSk7XG4gICAgICAgIHVwZGF0ZUJ1dHRvbi5kaXNhYmxlZCA9IHRoaXMuaXNVcGRhdGluZztcbiAgICAgICAgdXBkYXRlQnV0dG9uLm9uY2xpY2sgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5pc1VwZGF0aW5nID0gdHJ1ZTtcbiAgICAgICAgICB0aGlzLnVwZGF0ZVByb2dyZXNzID0gMDtcbiAgICAgICAgICB0aGlzLmRpc3BsYXkoKTtcblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5wZXJmb3JtVXBkYXRlKHRoaXMubGF0ZXN0VmVyc2lvbiwgKHN0ZXAsIHRvdGFsKSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMudXBkYXRlUHJvZ3Jlc3MgPSBzdGVwO1xuICAgICAgICAgICAgICB0aGlzLmRpc3BsYXkoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5pc1VwZGF0aW5nID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmxhdGVzdFZlcnNpb24gPSBcIlwiO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlID0gXCJcIjtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgdGhpcy5pc1VwZGF0aW5nID0gZmFsc2U7XG4gICAgICAgICAgICBuZXcgTm90aWNlKGDmm7TmlrDlpLHotKXvvJoke2Vycm9yfWApO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVSZXN1bHRNZXNzYWdlID0gYOabtOaWsOWksei0pe+8miR7ZXJyb3J9YDtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5kaXNwbGF5KCk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IFwi6Ieq5Yqo5pu05pawXCIsIGNsczogXCJhdXRvLWZyb250bWF0dGVyLWFib3V0LWNvbmZpZy10aXRsZVwiIH0pO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCLoh6rliqjmo4Dmn6Xmm7TmlrBcIilcbiAgICAgIC5zZXREZXNjKFwi5q+PIDYwIOWIhumSn+iHquWKqOajgOafpeW5tuabtOaWsOWIsOacgOaWsOeJiOacrOOAglwiKVxuICAgICAgLmFkZFRvZ2dsZSh0b2dnbGUgPT5cbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9VcGRhdGUpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jIHZhbHVlID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9VcGRhdGUgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuICB9XG59XG4iLCJpbXBvcnQge1xuICBNYXJrZG93blZpZXcsXG4gIFBsdWdpbixcbiAgRmlsZVN5c3RlbUFkYXB0ZXIsXG4gIEVkaXRvcixcbiAgTWVudSxcbiAgTWVudUl0ZW0sXG4gIFRGaWxlLFxuICBub3JtYWxpemVQYXRoLFxuICBOb3RpY2UsXG4gIGFkZEljb24sXG4gIE1hcmtkb3duRmlsZUluZm8sXG59IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgcmVzb2x2ZSwgcmVsYXRpdmUsIGpvaW4sIGJhc2VuYW1lLCBkaXJuYW1lIH0gZnJvbSBcInBhdGgtYnJvd3NlcmlmeVwiO1xuaW1wb3J0IHsgZXhpc3RzU3luYywgdW5saW5rIH0gZnJvbSBcImZzXCI7XG5pbXBvcnQgZml4UGF0aCBmcm9tIFwiZml4LXBhdGhcIjtcblxuaW1wb3J0IHtcbiAgaXNBc3NldFR5cGVBbkFzc2V0LFxuICBhcnJheVRvT2JqZWN0LFxuICBnZXRFbWJlZE1hcmtkb3duLFxuICBpc0h0bWxGaWxlLFxuICB3cmFwSHRtbFByZXZpZXdDb2RlLFxuICB3cmFwSHRtbFByZXZpZXdQYXRoLFxufSBmcm9tIFwiLi91dGlsc1wiO1xuaW1wb3J0IHsgcmVuZGVySHRtbFByZXZpZXcsIHNjYW5BbmRSZW5kZXJIdG1sUHJldmlld3MgfSBmcm9tIFwiLi9odG1sUHJldmlld1wiO1xuaW1wb3J0IHsgaHRtbFByZXZpZXdFeHRlbnNpb24gfSBmcm9tIFwiLi9odG1sUHJldmlld0VkaXRvclwiO1xuaW1wb3J0IHsgZG93bmxvYWRBbGxJbWFnZUZpbGVzIH0gZnJvbSBcIi4vZG93bmxvYWRcIjtcbmltcG9ydCB7IFBpY0dvVXBsb2FkZXIsIFBpY0dvQ29yZVVwbG9hZGVyIH0gZnJvbSBcIi4vdXBsb2FkZXJcIjtcbmltcG9ydCB7IFBpY0dvRGVsZXRlciB9IGZyb20gXCIuL2RlbGV0ZXJcIjtcbmltcG9ydCBIZWxwZXIgZnJvbSBcIi4vaGVscGVyXCI7XG5pbXBvcnQgeyB0IH0gZnJvbSBcIi4vbGFuZy9oZWxwZXJzXCI7XG5cbmltcG9ydCB7IFNldHRpbmdUYWIsIFBsdWdpblNldHRpbmdzLCBERUZBVUxUX1NFVFRJTkdTIH0gZnJvbSBcIi4vc2V0dGluZ1wiO1xuXG5jb25zdCBHSVRIVUJfUkFXX0JBU0UgPSBcImh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9saXV5aWZlbmc5Mi9vYnNpZGlhbi1wbHVnaW5zL21haW4vZmlsZS1hdXRvLXVwbG9hZC1wbHVnaW5cIjtcblxuaW50ZXJmYWNlIEltYWdlIHtcbiAgcGF0aDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIHNvdXJjZTogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgQ2xlYW51cFJvb3RBc3NldHNSZXN1bHQge1xuICBzY2FubmVkOiBudW1iZXI7XG4gIHVwbG9hZGVkOiBudW1iZXI7XG4gIHJlcGxhY2VkOiBudW1iZXI7XG4gIGRlbGV0ZWQ6IG51bWJlcjtcbiAgZmFpbGVkOiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgaW1hZ2VBdXRvVXBsb2FkUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgc2V0dGluZ3M6IFBsdWdpblNldHRpbmdzO1xuICBoZWxwZXI6IEhlbHBlcjtcbiAgZWRpdG9yOiBFZGl0b3I7XG4gIHBpY0dvVXBsb2FkZXI6IFBpY0dvVXBsb2FkZXI7XG4gIHBpY0dvRGVsZXRlcjogUGljR29EZWxldGVyO1xuICBwaWNHb0NvcmVVcGxvYWRlcjogUGljR29Db3JlVXBsb2FkZXI7XG4gIHVwbG9hZGVyOiBQaWNHb1VwbG9hZGVyIHwgUGljR29Db3JlVXBsb2FkZXI7XG4gIHByaXZhdGUgYXV0b1VwZGF0ZUNoZWNrVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHBlbmRpbmdBdXRvUmVsb2FkVGltZXI6IG51bWJlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHBlbmRpbmdBdXRvUmVsb2FkVmVyc2lvbiA9IFwiXCI7XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCkge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XG4gIH1cblxuICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcbiAgfVxuXG4gIG9udW5sb2FkKCkge1xuICAgIHRoaXMuY2xlYXJBdXRvVXBkYXRlQ2hlY2tUaW1lcigpO1xuICAgIHRoaXMuY2xlYXJQZW5kaW5nQXV0b1JlbG9hZFRpbWVyKCk7XG4gIH1cblxuICBhc3luYyBvbmxvYWQoKSB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcblxuICAgIHRoaXMuaGVscGVyID0gbmV3IEhlbHBlcih0aGlzLmFwcCk7XG4gICAgdGhpcy5waWNHb1VwbG9hZGVyID0gbmV3IFBpY0dvVXBsb2FkZXIodGhpcy5zZXR0aW5ncywgdGhpcyk7XG4gICAgdGhpcy5waWNHb0RlbGV0ZXIgPSBuZXcgUGljR29EZWxldGVyKHRoaXMpO1xuICAgIHRoaXMucGljR29Db3JlVXBsb2FkZXIgPSBuZXcgUGljR29Db3JlVXBsb2FkZXIodGhpcy5zZXR0aW5ncywgdGhpcyk7XG5cbiAgICBpZiAodGhpcy5zZXR0aW5ncy51cGxvYWRlciA9PT0gXCJQaWNHb1wiKSB7XG4gICAgICB0aGlzLnVwbG9hZGVyID0gdGhpcy5waWNHb1VwbG9hZGVyO1xuICAgIH0gZWxzZSBpZiAodGhpcy5zZXR0aW5ncy51cGxvYWRlciA9PT0gXCJQaWNHby1Db3JlXCIpIHtcbiAgICAgIHRoaXMudXBsb2FkZXIgPSB0aGlzLnBpY0dvQ29yZVVwbG9hZGVyO1xuICAgICAgaWYgKHRoaXMuc2V0dGluZ3MuZml4UGF0aCkge1xuICAgICAgICBmaXhQYXRoKCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ldyBOb3RpY2UoXCJ1bmtub3duIHVwbG9hZGVyXCIpO1xuICAgIH1cblxuICAgIGFkZEljb24oXG4gICAgICBcInVwbG9hZFwiLFxuICAgICAgYDxzdmcgdD1cIjE2MzY2MzA3ODM0MjlcIiBjbGFzcz1cImljb25cIiB2aWV3Qm94PVwiMCAwIDEwMCAxMDBcIiB2ZXJzaW9uPVwiMS4xXCIgcC1pZD1cIjQ2NDlcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+XG4gICAgICA8cGF0aCBkPVwiTSA3MS42MzggMzUuMzM2IEwgNzkuNDA4IDM1LjMzNiBDIDgzLjcgMzUuMzM2IDg3LjE3OCAzOC42NjIgODcuMTc4IDQyLjc2NSBMIDg3LjE3OCA4NC44NjQgQyA4Ny4xNzggODguOTY5IDgzLjcgOTIuMjk1IDc5LjQwOCA5Mi4yOTUgTCAxNy4yNDkgOTIuMjk1IEMgMTIuOTU3IDkyLjI5NSA5LjQ3OSA4OC45NjkgOS40NzkgODQuODY0IEwgOS40NzkgNDIuNzY1IEMgOS40NzkgMzguNjYyIDEyLjk1NyAzNS4zMzYgMTcuMjQ5IDM1LjMzNiBMIDI1LjAxOSAzNS4zMzYgTCAyNS4wMTkgNDIuNzY1IEwgMTcuMjQ5IDQyLjc2NSBMIDE3LjI0OSA4NC44NjQgTCA3OS40MDggODQuODY0IEwgNzkuNDA4IDQyLjc2NSBMIDcxLjYzOCA0Mi43NjUgTCA3MS42MzggMzUuMzM2IFogTSA0OS4wMTQgMTAuMTc5IEwgNjcuMzI2IDI3LjY4OCBMIDYxLjgzNSAzMi45NDIgTCA1Mi44NDkgMjQuMzUyIEwgNTIuODQ5IDU5LjczMSBMIDQ1LjA3OCA1OS43MzEgTCA0NS4wNzggMjQuNDU1IEwgMzYuMTk0IDMyLjk0NyBMIDMwLjcwMiAyNy42OTIgTCA0OS4wMTIgMTAuMTgxIFpcIiBwLWlkPVwiNDY1MFwiIGZpbGw9XCIjOGE4YThhXCI+PC9wYXRoPlxuICAgIDwvc3ZnPmBcbiAgICApO1xuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiVXBsb2FkIGFsbCBpbWFnZXNcIixcbiAgICAgIG5hbWU6IFwiVXBsb2FkIGFsbCBpbWFnZXNcIixcbiAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZzogYm9vbGVhbikgPT4ge1xuICAgICAgICBsZXQgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmO1xuICAgICAgICBpZiAobGVhZikge1xuICAgICAgICAgIGlmICghY2hlY2tpbmcpIHtcbiAgICAgICAgICAgIHRoaXMudXBsb2FkQWxsRmlsZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgIH0pO1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJEb3dubG9hZCBhbGwgaW1hZ2VzXCIsXG4gICAgICBuYW1lOiBcIkRvd25sb2FkIGFsbCBpbWFnZXNcIixcbiAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZzogYm9vbGVhbikgPT4ge1xuICAgICAgICBsZXQgbGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmO1xuICAgICAgICBpZiAobGVhZikge1xuICAgICAgICAgIGlmICghY2hlY2tpbmcpIHtcbiAgICAgICAgICAgIGRvd25sb2FkQWxsSW1hZ2VGaWxlcyh0aGlzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuc2V0dXBQYXN0ZUhhbmRsZXIoKTtcbiAgICB0aGlzLnJlZ2lzdGVyTWFya2Rvd25Db2RlQmxvY2tQcm9jZXNzb3IoXCJodG1sLXByZXZpZXdcIiwgKHNvdXJjZSwgZWwsIGN0eCkgPT5cbiAgICAgIHJlbmRlckh0bWxQcmV2aWV3KGVsLCBzb3VyY2UsIHRoaXMuYXBwKVxuICAgICk7XG4gICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duUG9zdFByb2Nlc3NvcihlbCA9PiB7XG4gICAgICBzY2FuQW5kUmVuZGVySHRtbFByZXZpZXdzKGVsLCB0aGlzLmFwcCk7XG4gICAgfSk7XG4gICAgdGhpcy5yZWdpc3RlckVkaXRvckV4dGVuc2lvbihodG1sUHJldmlld0V4dGVuc2lvbih0aGlzLmFwcCkpO1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCAoKSA9PiB7XG4gICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICBjb25zdCBhY3RpdmVWaWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcbiAgICAgICAgICBpZiAoIWFjdGl2ZVZpZXcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2NhbkFuZFJlbmRlckh0bWxQcmV2aWV3cyhhY3RpdmVWaWV3LmNvbnRhaW5lckVsLCB0aGlzLmFwcCk7XG4gICAgICAgIH0sIDIwMCk7XG4gICAgICB9KVxuICAgICk7XG4gICAgdGhpcy5yZWdpc3RlckZpbGVNZW51KCk7XG4gICAgdGhpcy5yZWdpc3RlckludGVydmFsKFxuICAgICAgd2luZG93LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3MuYXV0b0NsZWFudXBSb290KSB7XG4gICAgICAgICAgdGhpcy5jbGVhbnVwUm9vdEFzc2V0cygpLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJBdXRvIGNsZWFudXAgcm9vdCBhc3NldHMgZmFpbGVkOiBcIiwgZXJyb3IpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LCAzMCAqIDYwICogMTAwMClcbiAgICApO1xuXG4gICAgdGhpcy5yZWdpc3RlclNlbGVjdGlvbigpO1xuICAgIHRoaXMuc2NoZWR1bGVBdXRvVXBkYXRlQ2hlY2soKTtcbiAgfVxuXG4gIHJlZ2lzdGVyU2VsZWN0aW9uKCkge1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcbiAgICAgICAgXCJlZGl0b3ItbWVudVwiLFxuICAgICAgICAobWVudTogTWVudSwgZWRpdG9yOiBFZGl0b3IsIGluZm86IE1hcmtkb3duVmlldyB8IE1hcmtkb3duRmlsZUluZm8pID0+IHtcbiAgICAgICAgICBpZiAodGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShcIm1hcmtkb3duXCIpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBzZWxlY3Rpb24gPSBlZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG4gICAgICAgICAgaWYgKHNlbGVjdGlvbikge1xuICAgICAgICAgICAgY29uc3QgbWFya2Rvd25SZWdleCA9IC8hXFxbLipcXF1cXCgoLiopXFwpL2c7XG4gICAgICAgICAgICBjb25zdCBtYXJrZG93bk1hdGNoID0gbWFya2Rvd25SZWdleC5leGVjKHNlbGVjdGlvbik7XG4gICAgICAgICAgICBpZiAobWFya2Rvd25NYXRjaCAmJiBtYXJrZG93bk1hdGNoLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgY29uc3QgbWFya2Rvd25VcmwgPSBtYXJrZG93bk1hdGNoWzFdO1xuICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy51cGxvYWRlZEltYWdlcy5maW5kKFxuICAgICAgICAgICAgICAgICAgKGl0ZW06IHsgaW1nVXJsOiBzdHJpbmcgfSkgPT4gaXRlbS5pbWdVcmwgPT09IG1hcmtkb3duVXJsXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZE1lbnUobWVudSwgbWFya2Rvd25VcmwsIGVkaXRvcik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIClcbiAgICApO1xuICB9XG5cbiAgYWRkTWVudSA9IChtZW51OiBNZW51LCBpbWdQYXRoOiBzdHJpbmcsIGVkaXRvcjogRWRpdG9yKSA9PiB7XG4gICAgbWVudS5hZGRJdGVtKChpdGVtOiBNZW51SXRlbSkgPT5cbiAgICAgIGl0ZW1cbiAgICAgICAgLnNldEljb24oXCJ0cmFzaC0yXCIpXG4gICAgICAgIC5zZXRUaXRsZSh0KFwiRGVsZXRlIGltYWdlIHVzaW5nIFBpY0xpc3RcIikpXG4gICAgICAgIC5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWRJdGVtID0gdGhpcy5zZXR0aW5ncy51cGxvYWRlZEltYWdlcy5maW5kKFxuICAgICAgICAgICAgICAoaXRlbTogeyBpbWdVcmw6IHN0cmluZyB9KSA9PiBpdGVtLmltZ1VybCA9PT0gaW1nUGF0aFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGlmIChzZWxlY3RlZEl0ZW0pIHtcbiAgICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5waWNHb0RlbGV0ZXIuZGVsZXRlSW1hZ2UoW3NlbGVjdGVkSXRlbV0pO1xuICAgICAgICAgICAgICBpZiAocmVzLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICBuZXcgTm90aWNlKHQoXCJEZWxldGUgc3VjY2Vzc2Z1bGx5XCIpKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzZWxlY3Rpb24gPSBlZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHNlbGVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgZWRpdG9yLnJlcGxhY2VTZWxlY3Rpb24oXCJcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuc2V0dGluZ3MudXBsb2FkZWRJbWFnZXMgPVxuICAgICAgICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy51cGxvYWRlZEltYWdlcy5maWx0ZXIoXG4gICAgICAgICAgICAgICAgICAgIChpdGVtOiB7IGltZ1VybDogc3RyaW5nIH0pID0+IGl0ZW0uaW1nVXJsICE9PSBpbWdQYXRoXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHRoaXMuc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbmV3IE5vdGljZSh0KFwiRGVsZXRlIGZhaWxlZFwiKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIG5ldyBOb3RpY2UodChcIkVycm9yLCBjb3VsZCBub3QgZGVsZXRlXCIpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgKTtcbiAgfTtcblxuICByZWdpc3RlckZpbGVNZW51KCkge1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcbiAgICAgICAgXCJmaWxlLW1lbnVcIixcbiAgICAgICAgKG1lbnU6IE1lbnUsIGZpbGU6IFRGaWxlLCBzb3VyY2U6IHN0cmluZywgbGVhZikgPT4ge1xuICAgICAgICAgIGlmIChzb3VyY2UgPT09IFwiY2FudmFzLW1lbnVcIikgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIGlmICghaXNBc3NldFR5cGVBbkFzc2V0KGZpbGUucGF0aCkpIHJldHVybiBmYWxzZTtcblxuICAgICAgICAgIG1lbnUuYWRkSXRlbSgoaXRlbTogTWVudUl0ZW0pID0+IHtcbiAgICAgICAgICAgIGl0ZW1cbiAgICAgICAgICAgICAgLnNldFRpdGxlKFwiVXBsb2FkXCIpXG4gICAgICAgICAgICAgIC5zZXRJY29uKFwidXBsb2FkXCIpXG4gICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuZmlsZU1lbnVVcGxvYWQoZmlsZSk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICApXG4gICAgKTtcbiAgfVxuXG4gIGZpbGVNZW51VXBsb2FkKGZpbGU6IFRGaWxlKSB7XG4gICAgbGV0IGNvbnRlbnQgPSB0aGlzLmhlbHBlci5nZXRWYWx1ZSgpO1xuXG4gICAgY29uc3QgYmFzZVBhdGggPSAoXG4gICAgICB0aGlzLmFwcC52YXVsdC5hZGFwdGVyIGFzIEZpbGVTeXN0ZW1BZGFwdGVyXG4gICAgKS5nZXRCYXNlUGF0aCgpO1xuICAgIGxldCBpbWFnZUxpc3Q6IEltYWdlW10gPSBbXTtcbiAgICBjb25zdCBmaWxlQXJyYXkgPSB0aGlzLmhlbHBlci5nZXRBbGxGaWxlcygpO1xuXG4gICAgZm9yIChjb25zdCBtYXRjaCBvZiBmaWxlQXJyYXkpIHtcbiAgICAgIGNvbnN0IGltYWdlTmFtZSA9IG1hdGNoLm5hbWU7XG4gICAgICBjb25zdCBlbmNvZGVkVXJpID0gbWF0Y2gucGF0aDtcblxuICAgICAgY29uc3QgZmlsZU5hbWUgPSBiYXNlbmFtZShkZWNvZGVVUkkoZW5jb2RlZFVyaSkpO1xuXG4gICAgICBpZiAoZmlsZSAmJiBmaWxlLm5hbWUgPT09IGZpbGVOYW1lKSB7XG4gICAgICAgIGNvbnN0IGFic3RyYWN0SW1hZ2VGaWxlID0gam9pbihiYXNlUGF0aCwgZmlsZS5wYXRoKTtcblxuICAgICAgICBpZiAoaXNBc3NldFR5cGVBbkFzc2V0KGFic3RyYWN0SW1hZ2VGaWxlKSkge1xuICAgICAgICAgIGltYWdlTGlzdC5wdXNoKHtcbiAgICAgICAgICAgIHBhdGg6IGFic3RyYWN0SW1hZ2VGaWxlLFxuICAgICAgICAgICAgbmFtZTogaW1hZ2VOYW1lLFxuICAgICAgICAgICAgc291cmNlOiBtYXRjaC5zb3VyY2UsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaW1hZ2VMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgbmV3IE5vdGljZSh0KFwiQ2FuIG5vdCBmaW5kIGltYWdlIGZpbGVcIikpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMudXBsb2FkZXIudXBsb2FkRmlsZXMoaW1hZ2VMaXN0Lm1hcChpdGVtID0+IGl0ZW0ucGF0aCkpLnRoZW4ocmVzID0+IHtcbiAgICAgIGlmIChyZXMuc3VjY2Vzcykge1xuICAgICAgICBsZXQgdXBsb2FkVXJsTGlzdCA9IHJlcy5yZXN1bHQ7XG4gICAgICAgIGltYWdlTGlzdC5tYXAoaXRlbSA9PiB7XG4gICAgICAgICAgY29uc3QgdXBsb2FkSW1hZ2UgPSB1cGxvYWRVcmxMaXN0LnNoaWZ0KCk7XG4gICAgICAgICAgbGV0IG5hbWUgPSB0aGlzLmhhbmRsZU5hbWUoaXRlbS5uYW1lKTtcblxuICAgICAgICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2VBbGwoXG4gICAgICAgICAgICBpdGVtLnNvdXJjZSxcbiAgICAgICAgICAgIGdldEVtYmVkTWFya2Rvd24oaXRlbS5uYW1lLCB1cGxvYWRJbWFnZSwgbmFtZSlcbiAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5oZWxwZXIuc2V0VmFsdWUoY29udGVudCk7XG5cbiAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3MuZGVsZXRlU291cmNlKSB7XG4gICAgICAgICAgaW1hZ2VMaXN0Lm1hcChpbWFnZSA9PiB7XG4gICAgICAgICAgICBpZiAoIWltYWdlLnBhdGguc3RhcnRzV2l0aChcImh0dHBcIikpIHtcbiAgICAgICAgICAgICAgdW5saW5rKGltYWdlLnBhdGgsICgpID0+IHt9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3IE5vdGljZShcIlVwbG9hZCBlcnJvclwiKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGZpbHRlckZpbGUoZmlsZUFycmF5OiBJbWFnZVtdKSB7XG4gICAgY29uc3QgaW1hZ2VMaXN0OiBJbWFnZVtdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IG1hdGNoIG9mIGZpbGVBcnJheSkge1xuICAgICAgaWYgKG1hdGNoLnBhdGguc3RhcnRzV2l0aChcImh0dHBcIikpIHtcbiAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3Mud29ya09uTmV0V29yaykge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICF0aGlzLmhlbHBlci5oYXNCbGFja0RvbWFpbihcbiAgICAgICAgICAgICAgbWF0Y2gucGF0aCxcbiAgICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy5uZXdXb3JrQmxhY2tEb21haW5zXG4gICAgICAgICAgICApXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBpbWFnZUxpc3QucHVzaCh7XG4gICAgICAgICAgICAgIHBhdGg6IG1hdGNoLnBhdGgsXG4gICAgICAgICAgICAgIG5hbWU6IG1hdGNoLm5hbWUsXG4gICAgICAgICAgICAgIHNvdXJjZTogbWF0Y2guc291cmNlLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbWFnZUxpc3QucHVzaCh7XG4gICAgICAgICAgcGF0aDogbWF0Y2gucGF0aCxcbiAgICAgICAgICBuYW1lOiBtYXRjaC5uYW1lLFxuICAgICAgICAgIHNvdXJjZTogbWF0Y2guc291cmNlLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gaW1hZ2VMaXN0O1xuICB9XG4gIGdldEZpbGUoZmlsZU5hbWU6IHN0cmluZywgZmlsZU1hcDogYW55KSB7XG4gICAgaWYgKCFmaWxlTWFwKSB7XG4gICAgICBmaWxlTWFwID0gYXJyYXlUb09iamVjdCh0aGlzLmFwcC52YXVsdC5nZXRGaWxlcygpLCBcIm5hbWVcIik7XG4gICAgfVxuICAgIHJldHVybiBmaWxlTWFwW2ZpbGVOYW1lXTtcbiAgfVxuXG4gIGFzeW5jIGNsZWFudXBSb290QXNzZXRzKCk6IFByb21pc2U8Q2xlYW51cFJvb3RBc3NldHNSZXN1bHQ+IHtcbiAgICBjb25zdCByZXN1bHQ6IENsZWFudXBSb290QXNzZXRzUmVzdWx0ID0ge1xuICAgICAgc2Nhbm5lZDogMCxcbiAgICAgIHVwbG9hZGVkOiAwLFxuICAgICAgcmVwbGFjZWQ6IDAsXG4gICAgICBkZWxldGVkOiAwLFxuICAgICAgZmFpbGVkOiBbXSxcbiAgICB9O1xuICAgIGNvbnN0IGJhc2VQYXRoID0gKFxuICAgICAgdGhpcy5hcHAudmF1bHQuYWRhcHRlciBhcyBGaWxlU3lzdGVtQWRhcHRlclxuICAgICkuZ2V0QmFzZVBhdGgoKTtcbiAgICBjb25zdCByb290QXNzZXRzID0gdGhpcy5hcHAudmF1bHRcbiAgICAgIC5nZXRGaWxlcygpXG4gICAgICAuZmlsdGVyKFxuICAgICAgICBmaWxlID0+XG4gICAgICAgICAgZmlsZS5wYXRoID09PSBmaWxlLm5hbWUgJiZcbiAgICAgICAgICAoaXNBc3NldFR5cGVBbkFzc2V0KGZpbGUucGF0aCkgfHwgaXNIdG1sRmlsZShmaWxlLnBhdGgpKVxuICAgICAgKTtcbiAgICByZXN1bHQuc2Nhbm5lZCA9IHJvb3RBc3NldHMubGVuZ3RoO1xuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIHJvb3RBc3NldHMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGlmIChpc0h0bWxGaWxlKGZpbGUucGF0aCkpIHtcbiAgICAgICAgICBjb25zdCB0YXJnZXRQYXRoID0gdGhpcy5nZXRVbmlxdWVIdG1sRW1iZWRQYXRoKGZpbGUubmFtZSk7XG4gICAgICAgICAgY29uc3QgcHJldmlld0NvZGUgPSB3cmFwSHRtbFByZXZpZXdQYXRoKHRhcmdldFBhdGgpO1xuICAgICAgICAgIGNvbnN0IHJlcGxhY2VkID0gYXdhaXQgdGhpcy5yZXBsYWNlSHRtbEZpbGVSZWZlcmVuY2VzV2l0aENvZGUoXG4gICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgcHJldmlld0NvZGVcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgaWYgKHJlcGxhY2VkID09PSAwKSB7XG4gICAgICAgICAgICByZXN1bHQuZmFpbGVkLnB1c2goYCR7ZmlsZS5uYW1lfTog5rKh5pyJ56yU6K6w5byV55So6K+lIEhUTUwg5paH5Lu277yM5bey5L+d55WZYCk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZUh0bWxFbWJlZHNGb2xkZXIoKTtcbiAgICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlbmFtZShmaWxlLnBhdGgsIHRhcmdldFBhdGgpO1xuICAgICAgICAgIHJlc3VsdC5yZXBsYWNlZCArPSByZXBsYWNlZDtcbiAgICAgICAgICByZXN1bHQuZGVsZXRlZCsrO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdXBsb2FkUmVzdWx0ID0gYXdhaXQgdGhpcy51cGxvYWRlci51cGxvYWRGaWxlcyhbXG4gICAgICAgICAgam9pbihiYXNlUGF0aCwgZmlsZS5wYXRoKSxcbiAgICAgICAgXSk7XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICF1cGxvYWRSZXN1bHQuc3VjY2VzcyB8fFxuICAgICAgICAgICF1cGxvYWRSZXN1bHQucmVzdWx0IHx8XG4gICAgICAgICAgdXBsb2FkUmVzdWx0LnJlc3VsdC5sZW5ndGggPT09IDBcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmVzdWx0LmZhaWxlZC5wdXNoKGAke2ZpbGUubmFtZX06IOS4iuS8oOWksei0pSAke3VwbG9hZFJlc3VsdC5tc2cgfHwgXCJcIn1gLnRyaW0oKSk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXN1bHQudXBsb2FkZWQrKztcbiAgICAgICAgY29uc3QgdXBsb2FkVXJsID0gdGhpcy5nZXRVcGxvYWRVcmwodXBsb2FkUmVzdWx0LnJlc3VsdFswXSk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQXV0byBjbGVhbnVwIHJvb3QgYXNzZXQgdXBsb2FkZWQgVVJMOiBcIiwgdXBsb2FkVXJsKTtcblxuICAgICAgICBpZiAoIXVwbG9hZFVybCkge1xuICAgICAgICAgIHJlc3VsdC5mYWlsZWQucHVzaChgJHtmaWxlLm5hbWV9OiDkuIrkvKDmiJDlip/kvYbmsqHmnInmi7/liLDov5znqIsgVVJMYCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZXBsYWNlZCA9IGF3YWl0IHRoaXMucmVwbGFjZVJvb3RBc3NldExpbmtzKGZpbGUsIHVwbG9hZFVybCk7XG5cbiAgICAgICAgaWYgKHJlcGxhY2VkID09PSAwKSB7XG4gICAgICAgICAgcmVzdWx0LmZhaWxlZC5wdXNoKGAke2ZpbGUubmFtZX06IOS4iuS8oOaIkOWKn++8jOS9huayoeacieWcqOeslOiusOaWh+S7tuS4reaJvuWIsOW8leeUqO+8jOW3suS/neeVmeacrOWcsOaWh+S7tmApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0LnJlcGxhY2VkICs9IHJlcGxhY2VkO1xuICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5kZWxldGUoZmlsZSk7XG4gICAgICAgIHJlc3VsdC5kZWxldGVkKys7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCByZWFzb24gPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgICAgIHJlc3VsdC5mYWlsZWQucHVzaChgJHtmaWxlLm5hbWV9OiAke3JlYXNvbn1gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgYXN5bmMgY2xlYW51cFJvb3RBc3NldHNXaXRoTm90aWNlKCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY2xlYW51cFJvb3RBc3NldHMoKTtcblxuICAgIGlmIChyZXN1bHQuc2Nhbm5lZCA9PT0gMCkge1xuICAgICAgbmV3IE5vdGljZShcIuagueebruW9lea4heeQhu+8muayoeacieaJvuWIsOmcgOimgeS4iuS8oOeahOWbvueJh+aIlumfs+inhumikeaWh+S7tuOAglwiKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBzdW1tYXJ5ID0gYOagueebruW9lea4heeQhuWujOaIkO+8muaJq+aPjyAke3Jlc3VsdC5zY2FubmVkfSDkuKrvvIzkuIrkvKAgJHtyZXN1bHQudXBsb2FkZWR9IOS4qu+8jOabv+aNoiAke3Jlc3VsdC5yZXBsYWNlZH0g5aSE77yM5Yig6ZmkICR7cmVzdWx0LmRlbGV0ZWR9IOS4quOAgmA7XG5cbiAgICBpZiAocmVzdWx0LmZhaWxlZC5sZW5ndGggPT09IDApIHtcbiAgICAgIG5ldyBOb3RpY2Uoc3VtbWFyeSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbmV3IE5vdGljZShgJHtzdW1tYXJ5fVxcbuacquWujOaIkO+8miR7cmVzdWx0LmZhaWxlZC5zbGljZSgwLCAzKS5qb2luKFwi77ybXCIpfWApO1xuICB9XG5cbiAgZ2V0VXBsb2FkVXJsKHJlc3VsdDogYW55KSB7XG4gICAgaWYgKHR5cGVvZiByZXN1bHQgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgaWYgKHJlc3VsdCAmJiB0eXBlb2YgcmVzdWx0ID09PSBcIm9iamVjdFwiKSB7XG4gICAgICByZXR1cm4gcmVzdWx0LmltZ1VybCB8fCByZXN1bHQudXJsIHx8IHJlc3VsdC5wYXRoIHx8IFwiXCI7XG4gICAgfVxuXG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cblxuICBhc3luYyByZXBsYWNlUm9vdEFzc2V0TGlua3MoZmlsZTogVEZpbGUsIHVybDogc3RyaW5nKSB7XG4gICAgbGV0IHJlcGxhY2VkID0gMDtcblxuICAgIGZvciAoY29uc3Qgbm90ZUZpbGUgb2YgdGhpcy5hcHAudmF1bHQuZ2V0RmlsZXMoKS5maWx0ZXIodGhpcy5pc1JlZmVyZW5jZUZpbGUpKSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChub3RlRmlsZSk7XG4gICAgICBjb25zdCByZXN1bHQgPSBub3RlRmlsZS5leHRlbnNpb24gPT09IFwiY2FudmFzXCJcbiAgICAgICAgPyB0aGlzLnJlcGxhY2VDYW52YXNBc3NldExpbmtzKGNvbnRlbnQsIGZpbGUsIHVybClcbiAgICAgICAgOiB0aGlzLnJlcGxhY2VBc3NldExpbmtzKGNvbnRlbnQsIGZpbGUsIHVybCk7XG5cbiAgICAgIGlmIChyZXN1bHQuY29udGVudCAhPT0gY29udGVudCkge1xuICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkobm90ZUZpbGUsIHJlc3VsdC5jb250ZW50KTtcbiAgICAgICAgcmVwbGFjZWQgKz0gcmVzdWx0LnJlcGxhY2VkO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXBsYWNlZDtcbiAgfVxuXG4gIGlzUmVmZXJlbmNlRmlsZShmaWxlOiBURmlsZSkge1xuICAgIHJldHVybiBbXCJtZFwiLCBcImNhbnZhc1wiLCBcImh0bWxcIl0uaW5jbHVkZXMoZmlsZS5leHRlbnNpb24pO1xuICB9XG5cbiAgaXNTYW1lUm9vdEFzc2V0KHRhcmdldDogc3RyaW5nLCBmaWxlOiBURmlsZSkge1xuICAgIGxldCBwYXRoID0gdGFyZ2V0LnRyaW0oKTtcblxuICAgIGlmIChwYXRoLnN0YXJ0c1dpdGgoXCI8XCIpICYmIHBhdGguZW5kc1dpdGgoXCI+XCIpKSB7XG4gICAgICBwYXRoID0gcGF0aC5zbGljZSgxLCAtMSk7XG4gICAgfVxuICAgIGlmIChcbiAgICAgIChwYXRoLnN0YXJ0c1dpdGgoJ1wiJykgJiYgcGF0aC5lbmRzV2l0aCgnXCInKSkgfHxcbiAgICAgIChwYXRoLnN0YXJ0c1dpdGgoXCInXCIpICYmIHBhdGguZW5kc1dpdGgoXCInXCIpKVxuICAgICkge1xuICAgICAgcGF0aCA9IHBhdGguc2xpY2UoMSwgLTEpO1xuICAgIH1cblxuICAgIHBhdGggPSBwYXRoLnNwbGl0KFwiI1wiKVswXS5zcGxpdChcIj9cIilbMF07XG5cbiAgICB0cnkge1xuICAgICAgcGF0aCA9IGRlY29kZVVSSShwYXRoKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoL15bYS16XVthLXowLTkrLi1dKjovaS50ZXN0KHBhdGgpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgY29uc3Qgbm9ybWFsaXplZFBhdGggPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuXG4gICAgcmV0dXJuIG5vcm1hbGl6ZWRQYXRoID09PSBmaWxlLnBhdGggfHwgYmFzZW5hbWUobm9ybWFsaXplZFBhdGgpID09PSBmaWxlLm5hbWU7XG4gIH1cblxuICByZXBsYWNlQ2FudmFzQXNzZXRMaW5rcyhjb250ZW50OiBzdHJpbmcsIGZpbGU6IFRGaWxlLCB1cmw6IHN0cmluZykge1xuICAgIGxldCBkYXRhO1xuXG4gICAgdHJ5IHtcbiAgICAgIGRhdGEgPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY29udGVudCxcbiAgICAgICAgcmVwbGFjZWQ6IDAsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmICghQXJyYXkuaXNBcnJheShkYXRhLm5vZGVzKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY29udGVudCxcbiAgICAgICAgcmVwbGFjZWQ6IDAsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGxldCByZXBsYWNlZCA9IDA7XG5cbiAgICBkYXRhLm5vZGVzLmZvckVhY2goKG5vZGU6IGFueSkgPT4ge1xuICAgICAgaWYgKFxuICAgICAgICBub2RlICYmXG4gICAgICAgIG5vZGUudHlwZSA9PT0gXCJmaWxlXCIgJiZcbiAgICAgICAgdHlwZW9mIG5vZGUuZmlsZSA9PT0gXCJzdHJpbmdcIiAmJlxuICAgICAgICB0aGlzLmlzU2FtZVJvb3RBc3NldChub2RlLmZpbGUsIGZpbGUpXG4gICAgICApIHtcbiAgICAgICAgbm9kZS50eXBlID0gXCJsaW5rXCI7XG4gICAgICAgIG5vZGUudXJsID0gdXJsO1xuICAgICAgICBkZWxldGUgbm9kZS5maWxlO1xuICAgICAgICByZXBsYWNlZCsrO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbnRlbnQ6IHJlcGxhY2VkID4gMCA/IEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIFwiXFx0XCIpIDogY29udGVudCxcbiAgICAgIHJlcGxhY2VkLFxuICAgIH07XG4gIH1cblxuICByZXBsYWNlQXNzZXRMaW5rcyhjb250ZW50OiBzdHJpbmcsIGZpbGU6IFRGaWxlLCB1cmw6IHN0cmluZykge1xuICAgIGNvbnN0IGVzY2FwZVJlZ0V4cCA9ICh2YWx1ZTogc3RyaW5nKSA9PiB7XG4gICAgICByZXR1cm4gdmFsdWUucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICAgIH07XG5cbiAgICBjb25zdCB3aWtpbGlua1JlZ2V4ID0gLyFcXFtcXFsoW15cXF1dKylcXF1cXF0vZztcbiAgICBjb25zdCBtYXJrZG93bkltYWdlUmVnZXggPSAvIVxcWyhbXlxcXV0qKVxcXVxcKChbXildKylcXCkvZztcbiAgICBsZXQgcmVwbGFjZWQgPSAwO1xuICAgIGNvbnN0IHJlcGxhY2VtZW50czogc3RyaW5nW10gPSBbXTtcblxuICAgIGNvbnN0IG5ld0NvbnRlbnQgPSBjb250ZW50XG4gICAgICAucmVwbGFjZSh3aWtpbGlua1JlZ2V4LCAoc291cmNlLCB0YXJnZXQpID0+IHtcbiAgICAgICAgY29uc3QgcGF0aCA9IHRhcmdldC5zcGxpdChcInxcIilbMF07XG4gICAgICAgIGNvbnN0IGFsdCA9IHRhcmdldC5zcGxpdChcInxcIilbMV0gfHwgZmlsZS5uYW1lO1xuXG4gICAgICAgIGlmICghdGhpcy5pc1NhbWVSb290QXNzZXQocGF0aCwgZmlsZSkpIHtcbiAgICAgICAgICByZXR1cm4gc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVwbGFjZWQrKztcbiAgICAgICAgcmVwbGFjZW1lbnRzLnB1c2goZ2V0RW1iZWRNYXJrZG93bihmaWxlLm5hbWUsIHVybCwgYWx0KSk7XG4gICAgICAgIHJldHVybiBgXFx1MDAwMFJPT1RfQVNTRVRfJHtyZXBsYWNlbWVudHMubGVuZ3RoIC0gMX1cXHUwMDAwYDtcbiAgICAgIH0pXG4gICAgICAucmVwbGFjZShtYXJrZG93bkltYWdlUmVnZXgsIChzb3VyY2UsIGFsdCwgdGFyZ2V0KSA9PiB7XG4gICAgICAgIGlmICghdGhpcy5pc1NhbWVSb290QXNzZXQodGFyZ2V0LCBmaWxlKSkge1xuICAgICAgICAgIHJldHVybiBzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXBsYWNlZCsrO1xuICAgICAgICByZXBsYWNlbWVudHMucHVzaChnZXRFbWJlZE1hcmtkb3duKGZpbGUubmFtZSwgdXJsLCBhbHQpKTtcbiAgICAgICAgcmV0dXJuIGBcXHUwMDAwUk9PVF9BU1NFVF8ke3JlcGxhY2VtZW50cy5sZW5ndGggLSAxfVxcdTAwMDBgO1xuICAgICAgfSlcbiAgICAgIC5yZXBsYWNlKG5ldyBSZWdFeHAoZXNjYXBlUmVnRXhwKGZpbGUubmFtZSksIFwiZ1wiKSwgKHNvdXJjZSwgb2Zmc2V0LCBmdWxsQ29udGVudCkgPT4ge1xuICAgICAgICBpZiAoIWlzQXNzZXRUeXBlQW5Bc3NldChmaWxlLm5hbWUpKSB7XG4gICAgICAgICAgcmV0dXJuIHNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGJlZm9yZSA9IG9mZnNldCA+IDAgPyBmdWxsQ29udGVudFtvZmZzZXQgLSAxXSA6IFwiXCI7XG4gICAgICAgIGNvbnN0IGFmdGVyID0gZnVsbENvbnRlbnRbb2Zmc2V0ICsgc291cmNlLmxlbmd0aF0gfHwgXCJcIjtcblxuICAgICAgICBpZiAoL1tcXHB7TH1cXHB7Tn1fXFxbXFwoXFwvXFxcXC5cXC1dL3UudGVzdChiZWZvcmUpKSB7XG4gICAgICAgICAgcmV0dXJuIHNvdXJjZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoL1tcXHB7TH1cXHB7Tn1fXFxdXFwpXFx8XFwvXFxcXC5cXC1dL3UudGVzdChhZnRlcikpIHtcbiAgICAgICAgICByZXR1cm4gc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVwbGFjZWQrKztcbiAgICAgICAgcmV0dXJuIGdldEVtYmVkTWFya2Rvd24oZmlsZS5uYW1lLCB1cmwpO1xuICAgICAgfSlcbiAgICAgIC5yZXBsYWNlKC9cXHUwMDAwUk9PVF9BU1NFVF8oXFxkKylcXHUwMDAwL2csIChzb3VyY2UsIGluZGV4KSA9PiB7XG4gICAgICAgIHJldHVybiByZXBsYWNlbWVudHNbTnVtYmVyKGluZGV4KV0gfHwgc291cmNlO1xuICAgICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29udGVudDogbmV3Q29udGVudCxcbiAgICAgIHJlcGxhY2VkLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIHJlcGxhY2VIdG1sUmVmZXJlbmNlcyhcbiAgICBjb250ZW50OiBzdHJpbmcsXG4gICAgZmlsZTogVEZpbGUsXG4gICAgcHJldmlld0NvZGU6IHN0cmluZ1xuICApOiB7IGNvbnRlbnQ6IHN0cmluZzsgcmVwbGFjZWQ6IG51bWJlciB9IHtcbiAgICBjb25zdCB3aWtpbGlua1JlZ2V4ID0gLyFcXFtcXFsoW15cXF1dKylcXF1cXF0vZztcbiAgICBjb25zdCBtYXJrZG93bkxpbmtSZWdleCA9IC8hXFxbKFteXFxdXSopXFxdXFwoKFteKV0rKVxcKS9nO1xuICAgIGxldCByZXBsYWNlZCA9IDA7XG4gICAgY29uc3QgcmVwbGFjZW1lbnRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgY29uc3QgbmV3Q29udGVudCA9IGNvbnRlbnRcbiAgICAgIC5yZXBsYWNlKHdpa2lsaW5rUmVnZXgsIChtYXRjaCwgdGFyZ2V0KSA9PiB7XG4gICAgICAgIGNvbnN0IHBhdGggPSB0YXJnZXQuc3BsaXQoXCJ8XCIpWzBdO1xuXG4gICAgICAgIGlmICghdGhpcy5pc1NhbWVSb290QXNzZXQocGF0aCwgZmlsZSkpIHtcbiAgICAgICAgICByZXR1cm4gbWF0Y2g7XG4gICAgICAgIH1cblxuICAgICAgICByZXBsYWNlZCsrO1xuICAgICAgICByZXBsYWNlbWVudHMucHVzaChwcmV2aWV3Q29kZSk7XG4gICAgICAgIHJldHVybiBgXFx1MDAwMEhUTUxfQVNTRVRfJHtyZXBsYWNlbWVudHMubGVuZ3RoIC0gMX1cXHUwMDAwYDtcbiAgICAgIH0pXG4gICAgICAucmVwbGFjZShtYXJrZG93bkxpbmtSZWdleCwgKG1hdGNoLCBhbHQsIHRhcmdldCkgPT4ge1xuICAgICAgICBpZiAoIXRoaXMuaXNTYW1lUm9vdEFzc2V0KHRhcmdldCwgZmlsZSkpIHtcbiAgICAgICAgICByZXR1cm4gbWF0Y2g7XG4gICAgICAgIH1cblxuICAgICAgICByZXBsYWNlZCsrO1xuICAgICAgICByZXBsYWNlbWVudHMucHVzaChwcmV2aWV3Q29kZSk7XG4gICAgICAgIHJldHVybiBgXFx1MDAwMEhUTUxfQVNTRVRfJHtyZXBsYWNlbWVudHMubGVuZ3RoIC0gMX1cXHUwMDAwYDtcbiAgICAgIH0pXG4gICAgICAucmVwbGFjZSgvXFx1MDAwMEhUTUxfQVNTRVRfKFxcZCspXFx1MDAwMC9nLCAobWF0Y2gsIGluZGV4KSA9PiB7XG4gICAgICAgIHJldHVybiByZXBsYWNlbWVudHNbTnVtYmVyKGluZGV4KV0gfHwgbWF0Y2g7XG4gICAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBjb250ZW50OiBuZXdDb250ZW50LFxuICAgICAgcmVwbGFjZWQsXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVwbGFjZUh0bWxGaWxlUmVmZXJlbmNlcyhcbiAgICBmaWxlOiBURmlsZSxcbiAgICBzb3VyY2U6IHN0cmluZ1xuICApOiBQcm9taXNlPG51bWJlcj4ge1xuICAgIGNvbnN0IHByZXZpZXdDb2RlID0gd3JhcEh0bWxQcmV2aWV3Q29kZShzb3VyY2UpO1xuICAgIHJldHVybiB0aGlzLnJlcGxhY2VIdG1sRmlsZVJlZmVyZW5jZXNXaXRoQ29kZShmaWxlLCBwcmV2aWV3Q29kZSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlcGxhY2VIdG1sRmlsZVJlZmVyZW5jZXNXaXRoQ29kZShcbiAgICBmaWxlOiBURmlsZSxcbiAgICBwcmV2aWV3Q29kZTogc3RyaW5nXG4gICk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgbGV0IHJlcGxhY2VkID0gMDtcblxuICAgIGZvciAoY29uc3Qgbm90ZUZpbGUgb2YgdGhpcy5hcHAudmF1bHQuZ2V0RmlsZXMoKS5maWx0ZXIodGhpcy5pc1JlZmVyZW5jZUZpbGUpKSB7XG4gICAgICBpZiAobm90ZUZpbGUuZXh0ZW5zaW9uID09PSBcImNhbnZhc1wiIHx8IG5vdGVGaWxlLnBhdGggPT09IGZpbGUucGF0aCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQobm90ZUZpbGUpO1xuICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5yZXBsYWNlSHRtbFJlZmVyZW5jZXMoY29udGVudCwgZmlsZSwgcHJldmlld0NvZGUpO1xuXG4gICAgICBpZiAocmVzdWx0LmNvbnRlbnQgIT09IGNvbnRlbnQpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KG5vdGVGaWxlLCByZXN1bHQuY29udGVudCk7XG4gICAgICAgIHJlcGxhY2VkICs9IHJlc3VsdC5yZXBsYWNlZDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVwbGFjZWQ7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGVuc3VyZUh0bWxFbWJlZHNGb2xkZXIoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZm9sZGVyUGF0aCA9IFwiLmh0bWwtZW1iZWRzXCI7XG4gICAgaWYgKCEoYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMoZm9sZGVyUGF0aCkpKSB7XG4gICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLm1rZGlyKGZvbGRlclBhdGgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0VW5pcXVlSHRtbEVtYmVkUGF0aChmaWxlTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBiYXNlUGF0aCA9IFwiLmh0bWwtZW1iZWRzL1wiO1xuICAgIGxldCB0YXJnZXRQYXRoID0gYCR7YmFzZVBhdGh9JHtmaWxlTmFtZX1gO1xuXG4gICAgaWYgKCF0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgodGFyZ2V0UGF0aCkpIHtcbiAgICAgIHJldHVybiB0YXJnZXRQYXRoO1xuICAgIH1cblxuICAgIGNvbnN0IHRpbWVzdGFtcCA9IERhdGUubm93KCk7XG4gICAgY29uc3QgZXh0SW5kZXggPSBmaWxlTmFtZS5sYXN0SW5kZXhPZihcIi5cIik7XG4gICAgY29uc3QgYmFzZU5hbWUgPSBleHRJbmRleCA+IDAgPyBmaWxlTmFtZS5zbGljZSgwLCBleHRJbmRleCkgOiBmaWxlTmFtZTtcbiAgICBjb25zdCBleHQgPSBleHRJbmRleCA+IDAgPyBmaWxlTmFtZS5zbGljZShleHRJbmRleCkgOiBcIlwiO1xuICAgIHRhcmdldFBhdGggPSBgJHtiYXNlUGF0aH0ke2Jhc2VOYW1lfS0ke3RpbWVzdGFtcH0ke2V4dH1gO1xuXG4gICAgcmV0dXJuIHRhcmdldFBhdGg7XG4gIH1cblxuICBwcml2YXRlIGdldEh0bWxGaWxlU291cmNlUGF0aChmaWxlOiBGaWxlKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgaWYgKGZpbGUucGF0aCkge1xuICAgICAgcmV0dXJuIGZpbGUucGF0aDtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgeyB3ZWJVdGlscyB9ID0gKHdpbmRvdyBhcyBhbnkpLnJlcXVpcmUoXCJlbGVjdHJvblwiKTtcbiAgICAgIHJldHVybiB3ZWJVdGlscy5nZXRQYXRoRm9yRmlsZShmaWxlKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgcmVhZEZpbGVBc1RleHQoZmlsZTogRmlsZSk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICByZWFkZXIub25sb2FkID0gKCkgPT4gcmVzb2x2ZShTdHJpbmcocmVhZGVyLnJlc3VsdCA/PyBcIlwiKSk7XG4gICAgICByZWFkZXIub25lcnJvciA9ICgpID0+IHJlamVjdChyZWFkZXIuZXJyb3IpO1xuICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIG1vdmVIdG1sRmlsZVRvRW1iZWRzKGZpbGU6IEZpbGUpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGF3YWl0IHRoaXMuZW5zdXJlSHRtbEVtYmVkc0ZvbGRlcigpO1xuXG4gICAgY29uc3QgdGFyZ2V0UGF0aCA9IHRoaXMuZ2V0VW5pcXVlSHRtbEVtYmVkUGF0aChmaWxlLm5hbWUpO1xuICAgIGNvbnN0IHNvdXJjZVBhdGggPSB0aGlzLmdldEh0bWxGaWxlU291cmNlUGF0aChmaWxlKTtcblxuICAgIGlmIChzb3VyY2VQYXRoKSB7XG4gICAgICBjb25zdCBiYXNlUGF0aCA9IG5vcm1hbGl6ZVBhdGgoXG4gICAgICAgICh0aGlzLmFwcC52YXVsdC5hZGFwdGVyIGFzIEZpbGVTeXN0ZW1BZGFwdGVyKS5nZXRCYXNlUGF0aCgpXG4gICAgICApO1xuICAgICAgY29uc3Qgbm9ybWFsaXplZFNvdXJjZSA9IG5vcm1hbGl6ZVBhdGgoc291cmNlUGF0aCk7XG5cbiAgICAgIGlmIChcbiAgICAgICAgbm9ybWFsaXplZFNvdXJjZS5zdGFydHNXaXRoKGJhc2VQYXRoICsgXCIvXCIpICYmXG4gICAgICAgIG5vcm1hbGl6ZWRTb3VyY2UgIT09IG5vcm1hbGl6ZVBhdGgoam9pbihiYXNlUGF0aCwgdGFyZ2V0UGF0aCkpXG4gICAgICApIHtcbiAgICAgICAgY29uc3QgcmVsYXRpdmVTb3VyY2UgPSBub3JtYWxpemVkU291cmNlLnNsaWNlKGJhc2VQYXRoLmxlbmd0aCArIDEpO1xuICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLnJlbmFtZShyZWxhdGl2ZVNvdXJjZSwgdGFyZ2V0UGF0aCk7XG4gICAgICAgIHJldHVybiB0YXJnZXRQYXRoO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLnJlYWRGaWxlQXNUZXh0KGZpbGUpO1xuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUodGFyZ2V0UGF0aCwgY29udGVudCk7XG4gICAgcmV0dXJuIHRhcmdldFBhdGg7XG4gIH1cblxuICAvLyB1cGxvZGEgYWxsIGZpbGVcbiAgdXBsb2FkQWxsRmlsZSgpIHtcbiAgICBsZXQgY29udGVudCA9IHRoaXMuaGVscGVyLmdldFZhbHVlKCk7XG5cbiAgICBjb25zdCBiYXNlUGF0aCA9IChcbiAgICAgIHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIgYXMgRmlsZVN5c3RlbUFkYXB0ZXJcbiAgICApLmdldEJhc2VQYXRoKCk7XG4gICAgY29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgY29uc3QgZmlsZU1hcCA9IGFycmF5VG9PYmplY3QodGhpcy5hcHAudmF1bHQuZ2V0RmlsZXMoKSwgXCJuYW1lXCIpO1xuICAgIGNvbnN0IGZpbGVQYXRoTWFwID0gYXJyYXlUb09iamVjdCh0aGlzLmFwcC52YXVsdC5nZXRGaWxlcygpLCBcInBhdGhcIik7XG4gICAgbGV0IGltYWdlTGlzdDogSW1hZ2VbXSA9IFtdO1xuICAgIGNvbnN0IGZpbGVBcnJheSA9IHRoaXMuZmlsdGVyRmlsZSh0aGlzLmhlbHBlci5nZXRBbGxGaWxlcygpKTtcblxuICAgIGZvciAoY29uc3QgbWF0Y2ggb2YgZmlsZUFycmF5KSB7XG4gICAgICBjb25zdCBpbWFnZU5hbWUgPSBtYXRjaC5uYW1lO1xuICAgICAgY29uc3QgZW5jb2RlZFVyaSA9IG1hdGNoLnBhdGg7XG5cbiAgICAgIGlmIChlbmNvZGVkVXJpLnN0YXJ0c1dpdGgoXCJodHRwXCIpKSB7XG4gICAgICAgIGltYWdlTGlzdC5wdXNoKHtcbiAgICAgICAgICBwYXRoOiBtYXRjaC5wYXRoLFxuICAgICAgICAgIG5hbWU6IGltYWdlTmFtZSxcbiAgICAgICAgICBzb3VyY2U6IG1hdGNoLnNvdXJjZSxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBmaWxlTmFtZSA9IGJhc2VuYW1lKGRlY29kZVVSSShlbmNvZGVkVXJpKSk7XG4gICAgICAgIGxldCBmaWxlO1xuICAgICAgICAvLyDnu53lr7not6/lvoRcbiAgICAgICAgaWYgKGZpbGVQYXRoTWFwW2RlY29kZVVSSShlbmNvZGVkVXJpKV0pIHtcbiAgICAgICAgICBmaWxlID0gZmlsZVBhdGhNYXBbZGVjb2RlVVJJKGVuY29kZWRVcmkpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOebuOWvuei3r+W+hFxuICAgICAgICBpZiAoXG4gICAgICAgICAgKCFmaWxlICYmIGRlY29kZVVSSShlbmNvZGVkVXJpKS5zdGFydHNXaXRoKFwiLi9cIikpIHx8XG4gICAgICAgICAgZGVjb2RlVVJJKGVuY29kZWRVcmkpLnN0YXJ0c1dpdGgoXCIuLi9cIilcbiAgICAgICAgKSB7XG4gICAgICAgICAgY29uc3QgZmlsZVBhdGggPSByZXNvbHZlKFxuICAgICAgICAgICAgam9pbihiYXNlUGF0aCwgZGlybmFtZShhY3RpdmVGaWxlLnBhdGgpKSxcbiAgICAgICAgICAgIGRlY29kZVVSSShlbmNvZGVkVXJpKVxuICAgICAgICAgICk7XG5cbiAgICAgICAgICBpZiAoZXhpc3RzU3luYyhmaWxlUGF0aCkpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhdGggPSBub3JtYWxpemVQYXRoKFxuICAgICAgICAgICAgICByZWxhdGl2ZShcbiAgICAgICAgICAgICAgICBub3JtYWxpemVQYXRoKGJhc2VQYXRoKSxcbiAgICAgICAgICAgICAgICBub3JtYWxpemVQYXRoKFxuICAgICAgICAgICAgICAgICAgcmVzb2x2ZShcbiAgICAgICAgICAgICAgICAgICAgam9pbihiYXNlUGF0aCwgZGlybmFtZShhY3RpdmVGaWxlLnBhdGgpKSxcbiAgICAgICAgICAgICAgICAgICAgZGVjb2RlVVJJKGVuY29kZWRVcmkpXG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBmaWxlID0gZmlsZVBhdGhNYXBbcGF0aF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIOWwveWPr+iDveefrei3r+W+hFxuICAgICAgICBpZiAoIWZpbGUpIHtcbiAgICAgICAgICBmaWxlID0gdGhpcy5nZXRGaWxlKGZpbGVOYW1lLCBmaWxlTWFwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgICAgY29uc3QgYWJzdHJhY3RJbWFnZUZpbGUgPSBqb2luKGJhc2VQYXRoLCBmaWxlLnBhdGgpO1xuXG4gICAgICAgICAgaWYgKGlzQXNzZXRUeXBlQW5Bc3NldChhYnN0cmFjdEltYWdlRmlsZSkpIHtcbiAgICAgICAgICAgIGltYWdlTGlzdC5wdXNoKHtcbiAgICAgICAgICAgICAgcGF0aDogYWJzdHJhY3RJbWFnZUZpbGUsXG4gICAgICAgICAgICAgIG5hbWU6IGltYWdlTmFtZSxcbiAgICAgICAgICAgICAgc291cmNlOiBtYXRjaC5zb3VyY2UsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaW1hZ2VMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgbmV3IE5vdGljZSh0KFwiQ2FuIG5vdCBmaW5kIGltYWdlIGZpbGVcIikpO1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXcgTm90aWNlKGDlhbHmib7liLAke2ltYWdlTGlzdC5sZW5ndGh95Liq5Zu+5YOP5paH5Lu277yM5byA5aeL5LiK5LygYCk7XG4gICAgfVxuXG4gICAgdGhpcy51cGxvYWRlci51cGxvYWRGaWxlcyhpbWFnZUxpc3QubWFwKGl0ZW0gPT4gaXRlbS5wYXRoKSkudGhlbihyZXMgPT4ge1xuICAgICAgaWYgKHJlcy5zdWNjZXNzKSB7XG4gICAgICAgIGxldCB1cGxvYWRVcmxMaXN0ID0gcmVzLnJlc3VsdDtcblxuICAgICAgICBpZiAoaW1hZ2VMaXN0Lmxlbmd0aCAhPT0gdXBsb2FkVXJsTGlzdC5sZW5ndGgpIHtcbiAgICAgICAgICBuZXcgTm90aWNlKFxuICAgICAgICAgICAgdChcIldhcm5pbmc6IHVwbG9hZCBmaWxlcyBpcyBkaWZmZXJlbnQgb2YgcmVjaXZlciBmaWxlcyBmcm9tIGFwaVwiKVxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBpbWFnZUxpc3QubWFwKGl0ZW0gPT4ge1xuICAgICAgICAgIGNvbnN0IHVwbG9hZEltYWdlID0gdXBsb2FkVXJsTGlzdC5zaGlmdCgpO1xuXG4gICAgICAgICAgbGV0IG5hbWUgPSB0aGlzLmhhbmRsZU5hbWUoaXRlbS5uYW1lKTtcbiAgICAgICAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlQWxsKFxuICAgICAgICAgICAgaXRlbS5zb3VyY2UsXG4gICAgICAgICAgICBnZXRFbWJlZE1hcmtkb3duKGl0ZW0ubmFtZSwgdXBsb2FkSW1hZ2UsIG5hbWUpXG4gICAgICAgICAgKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRGaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICAgICAgaWYgKGFjdGl2ZUZpbGUucGF0aCAhPT0gY3VycmVudEZpbGUucGF0aCkge1xuICAgICAgICAgIG5ldyBOb3RpY2UodChcIkZpbGUgaGFzIGJlZW4gY2hhbmdlZGQsIHVwbG9hZCBmYWlsdXJlXCIpKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5oZWxwZXIuc2V0VmFsdWUoY29udGVudCk7XG5cbiAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3MuZGVsZXRlU291cmNlKSB7XG4gICAgICAgICAgaW1hZ2VMaXN0Lm1hcChpbWFnZSA9PiB7XG4gICAgICAgICAgICBpZiAoIWltYWdlLnBhdGguc3RhcnRzV2l0aChcImh0dHBcIikpIHtcbiAgICAgICAgICAgICAgdW5saW5rKGltYWdlLnBhdGgsICgpID0+IHt9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3IE5vdGljZShcIlVwbG9hZCBlcnJvclwiKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHNldHVwUGFzdGVIYW5kbGVyKCkge1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcbiAgICAgICAgXCJlZGl0b3ItcGFzdGVcIixcbiAgICAgICAgKGV2dDogQ2xpcGJvYXJkRXZlbnQsIGVkaXRvcjogRWRpdG9yLCBtYXJrZG93blZpZXc6IE1hcmtkb3duVmlldykgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhbGxvd1VwbG9hZCA9IHRoaXMuaGVscGVyLmdldEZyb250bWF0dGVyVmFsdWUoXG4gICAgICAgICAgICAgIFwiaW1hZ2UtYXV0by11cGxvYWRcIixcbiAgICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy51cGxvYWRCeUNsaXBTd2l0Y2hcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGxldCBmaWxlcyA9IGV2dC5jbGlwYm9hcmREYXRhLmZpbGVzO1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJbZmlsZS1hdXRvLXVwbG9hZF0gcGFzdGUgZXZlbnQgZmlyZWQsIGZpbGVzOlwiLCBmaWxlcz8ubGVuZ3RoKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICAgICBcIltmaWxlLWF1dG8tdXBsb2FkXSBmaWxlIHR5cGU6XCIsXG4gICAgICAgICAgICAgIGZpbGVzPy5bMF0/LnR5cGUsXG4gICAgICAgICAgICAgIFwibmFtZTpcIixcbiAgICAgICAgICAgICAgZmlsZXM/LlswXT8ubmFtZVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgaWYgKCFhbGxvd1VwbG9hZCkge1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGh0bWxGaWxlID0gQXJyYXkuZnJvbShmaWxlcykuZmluZChmaWxlID0+IGlzSHRtbEZpbGUoZmlsZS5uYW1lKSk7XG4gICAgICAgICAgICBpZiAoaHRtbEZpbGUpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgICAgICAgXCJbZmlsZS1hdXRvLXVwbG9hZF0gZGV0ZWN0ZWQgSFRNTCBmaWxlLCBlbnRlcmluZyBodG1sLXByZXZpZXcgZmxvd1wiXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmluc2VydEh0bWxQcmV2aWV3Q29kZUJsb2NrKGVkaXRvciwgaHRtbEZpbGUpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRmFpbGVkIHRvIGluc2VydCBIVE1MIGZpbGU6IFwiLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KSgpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIOWJqui0tOadv+WGheWuueaciW1k5qC85byP55qE5Zu+54mH5pe2XG4gICAgICAgICAgICBpZiAodGhpcy5zZXR0aW5ncy53b3JrT25OZXRXb3JrKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGNsaXBib2FyZFZhbHVlID0gZXZ0LmNsaXBib2FyZERhdGEuZ2V0RGF0YShcInRleHQvcGxhaW5cIik7XG4gICAgICAgICAgICAgIGNvbnN0IGltYWdlTGlzdCA9IHRoaXMuaGVscGVyXG4gICAgICAgICAgICAgICAgLmdldEltYWdlTGluayhjbGlwYm9hcmRWYWx1ZSlcbiAgICAgICAgICAgICAgICAuZmlsdGVyKGltYWdlID0+IGltYWdlLnBhdGguc3RhcnRzV2l0aChcImh0dHBcIikpXG4gICAgICAgICAgICAgICAgLmZpbHRlcihcbiAgICAgICAgICAgICAgICAgIGltYWdlID0+XG4gICAgICAgICAgICAgICAgICAgICF0aGlzLmhlbHBlci5oYXNCbGFja0RvbWFpbihcbiAgICAgICAgICAgICAgICAgICAgICBpbWFnZS5wYXRoLFxuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0dGluZ3MubmV3V29ya0JsYWNrRG9tYWluc1xuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICBpZiAoaW1hZ2VMaXN0Lmxlbmd0aCAhPT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMudXBsb2FkZXJcbiAgICAgICAgICAgICAgICAgIC51cGxvYWRGaWxlcyhpbWFnZUxpc3QubWFwKGl0ZW0gPT4gaXRlbS5wYXRoKSlcbiAgICAgICAgICAgICAgICAgIC50aGVuKHJlcyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxldCB2YWx1ZSA9IHRoaXMuaGVscGVyLmdldFZhbHVlKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXMuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgIGxldCB1cGxvYWRVcmxMaXN0ID0gcmVzLnJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgICBpbWFnZUxpc3QubWFwKGl0ZW0gPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXBsb2FkSW1hZ2UgPSB1cGxvYWRVcmxMaXN0LnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbmFtZSA9IHRoaXMuaGFuZGxlTmFtZShpdGVtLm5hbWUpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlLnJlcGxhY2VBbGwoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0uc291cmNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBnZXRFbWJlZE1hcmtkb3duKGl0ZW0ubmFtZSwgdXBsb2FkSW1hZ2UsIG5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuaGVscGVyLnNldFZhbHVlKHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBuZXcgTm90aWNlKFwiVXBsb2FkIGVycm9yXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyDliarotLTmnb/kuK3mmK/lm77niYfml7bov5vooYzkuIrkvKBcbiAgICAgICAgICAgIGlmICh0aGlzLmNhblVwbG9hZChldnQuY2xpcGJvYXJkRGF0YSkpIHtcbiAgICAgICAgICAgICAgdGhpcy51cGxvYWRGaWxlQW5kRW1iZWRJbWd1ckltYWdlKFxuICAgICAgICAgICAgICAgIGVkaXRvcixcbiAgICAgICAgICAgICAgICBhc3luYyAoZWRpdG9yOiBFZGl0b3IsIHBhc3RlSWQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgICAgbGV0IHJlczogYW55O1xuICAgICAgICAgICAgICAgICAgcmVzID0gYXdhaXQgdGhpcy51cGxvYWRlci51cGxvYWRGaWxlQnlDbGlwYm9hcmQoXG4gICAgICAgICAgICAgICAgICAgIGV2dC5jbGlwYm9hcmREYXRhLmZpbGVzXG4gICAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgICAgICBpZiAocmVzLmNvZGUgIT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVGYWlsZWRVcGxvYWQoZWRpdG9yLCBwYXN0ZUlkLCByZXMubXNnKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgY29uc3QgdXJsID0gcmVzLmRhdGE7XG5cbiAgICAgICAgICAgICAgICAgIHJldHVybiB1cmw7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBldnQuY2xpcGJvYXJkRGF0YVxuICAgICAgICAgICAgICApLmNhdGNoKCk7XG4gICAgICAgICAgICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW2ZpbGUtYXV0by11cGxvYWRdIHBhc3RlIGhhbmRsZXIgZXJyb3I6XCIsIGVycm9yKTtcbiAgICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgLy8g6YeN572u5omA5pyJ54q25oCBIGZsYWdcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIClcbiAgICApO1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcbiAgICAgICAgXCJlZGl0b3ItZHJvcFwiLFxuICAgICAgICBhc3luYyAoZXZ0OiBEcmFnRXZlbnQsIGVkaXRvcjogRWRpdG9yLCBtYXJrZG93blZpZXc6IE1hcmtkb3duVmlldykgPT4ge1xuICAgICAgICAgIC8vIHdoZW4gY3RybCBrZXkgaXMgcHJlc3NlZCwgZG8gbm90IHVwbG9hZCBpbWFnZSwgYmVjYXVzZSBpdCBpcyB1c2VkIHRvIHNldCBsb2NhbCBmaWxlXG4gICAgICAgICAgaWYgKGV2dC5jdHJsS2V5KSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGFsbG93VXBsb2FkID0gdGhpcy5oZWxwZXIuZ2V0RnJvbnRtYXR0ZXJWYWx1ZShcbiAgICAgICAgICAgIFwiaW1hZ2UtYXV0by11cGxvYWRcIixcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3MudXBsb2FkQnlDbGlwU3dpdGNoXG4gICAgICAgICAgKTtcbiAgICAgICAgICBsZXQgZmlsZXMgPSBldnQuZGF0YVRyYW5zZmVyLmZpbGVzO1xuXG4gICAgICAgICAgaWYgKCFhbGxvd1VwbG9hZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGh0bWxGaWxlID0gQXJyYXkuZnJvbShmaWxlcykuZmluZChmaWxlID0+IGlzSHRtbEZpbGUoZmlsZS5uYW1lKSk7XG4gICAgICAgICAgaWYgKGh0bWxGaWxlKSB7XG4gICAgICAgICAgICBldnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGF3YWl0IHRoaXMuaW5zZXJ0SHRtbFByZXZpZXdDb2RlQmxvY2soZWRpdG9yLCBodG1sRmlsZSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRmFpbGVkIHRvIGluc2VydCBIVE1MIGZpbGU6IFwiLCBlcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgZmlsZXMubGVuZ3RoICE9PSAwICYmXG4gICAgICAgICAgICAoZmlsZXNbMF0udHlwZS5zdGFydHNXaXRoKFwiaW1hZ2VcIikgfHxcbiAgICAgICAgICAgICAgZmlsZXNbMF0udHlwZS5zdGFydHNXaXRoKFwidmlkZW9cIikgfHxcbiAgICAgICAgICAgICAgZmlsZXNbMF0udHlwZS5zdGFydHNXaXRoKFwiYXVkaW9cIikpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBsZXQgc2VuZEZpbGVzOiBBcnJheTxzdHJpbmc+ID0gW107XG4gICAgICAgICAgICBsZXQgZmlsZXMgPSBldnQuZGF0YVRyYW5zZmVyLmZpbGVzO1xuICAgICAgICAgICAgQXJyYXkuZnJvbShmaWxlcykuZm9yRWFjaCgoaXRlbSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgICAgaWYgKGl0ZW0ucGF0aCkge1xuICAgICAgICAgICAgICAgIHNlbmRGaWxlcy5wdXNoKGl0ZW0ucGF0aCk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyB3ZWJVdGlscyB9ID0gcmVxdWlyZShcImVsZWN0cm9uXCIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhdGggPSB3ZWJVdGlscy5nZXRQYXRoRm9yRmlsZShpdGVtKTtcbiAgICAgICAgICAgICAgICBzZW5kRmlsZXMucHVzaChwYXRoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBldnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMudXBsb2FkZXIudXBsb2FkRmlsZXMoc2VuZEZpbGVzKTtcblxuICAgICAgICAgICAgaWYgKGRhdGEuc3VjY2Vzcykge1xuICAgICAgICAgICAgICBkYXRhLnJlc3VsdC5tYXAoKHZhbHVlOiBzdHJpbmcsIGluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgICBsZXQgcGFzdGVJZCA9IChNYXRoLnJhbmRvbSgpICsgMSkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCA1KTtcbiAgICAgICAgICAgICAgICB0aGlzLmluc2VydFRlbXBvcmFyeVRleHQoZWRpdG9yLCBwYXN0ZUlkKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVtYmVkTWFya0Rvd25JbWFnZShcbiAgICAgICAgICAgICAgICAgIGVkaXRvcixcbiAgICAgICAgICAgICAgICAgIHBhc3RlSWQsXG4gICAgICAgICAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgIGZpbGVzW2luZGV4XS5uYW1lXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBuZXcgTm90aWNlKFwiVXBsb2FkIGVycm9yXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgKVxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGluc2VydEh0bWxQcmV2aWV3Q29kZUJsb2NrKFxuICAgIGVkaXRvcjogRWRpdG9yLFxuICAgIGZpbGU6IEZpbGVcbiAgKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCB0YXJnZXRQYXRoID0gYXdhaXQgdGhpcy5tb3ZlSHRtbEZpbGVUb0VtYmVkcyhmaWxlKTtcbiAgICBlZGl0b3IucmVwbGFjZVNlbGVjdGlvbih3cmFwSHRtbFByZXZpZXdQYXRoKHRhcmdldFBhdGgpKTtcbiAgICByZXR1cm4gdGFyZ2V0UGF0aDtcbiAgfVxuXG4gIGNhblVwbG9hZChjbGlwYm9hcmREYXRhOiBEYXRhVHJhbnNmZXIpIHtcbiAgICB0aGlzLnNldHRpbmdzLmFwcGx5SW1hZ2U7XG4gICAgY29uc3QgZmlsZXMgPSBjbGlwYm9hcmREYXRhLmZpbGVzO1xuICAgIGNvbnN0IHRleHQgPSBjbGlwYm9hcmREYXRhLmdldERhdGEoXCJ0ZXh0XCIpO1xuXG4gICAgY29uc3QgaGFzSW1hZ2VGaWxlID1cbiAgICAgIGZpbGVzLmxlbmd0aCAhPT0gMCAmJlxuICAgICAgKGZpbGVzWzBdLnR5cGUuc3RhcnRzV2l0aChcImltYWdlXCIpIHx8XG4gICAgICAgIGZpbGVzWzBdLnR5cGUuc3RhcnRzV2l0aChcInZpZGVvXCIpIHx8XG4gICAgICAgIGZpbGVzWzBdLnR5cGUuc3RhcnRzV2l0aChcImF1ZGlvXCIpKTtcbiAgICBpZiAoaGFzSW1hZ2VGaWxlKSB7XG4gICAgICBpZiAoISF0ZXh0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldHRpbmdzLmFwcGx5SW1hZ2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHVwbG9hZEZpbGVBbmRFbWJlZEltZ3VySW1hZ2UoXG4gICAgZWRpdG9yOiBFZGl0b3IsXG4gICAgY2FsbGJhY2s6IEZ1bmN0aW9uLFxuICAgIGNsaXBib2FyZERhdGE6IERhdGFUcmFuc2ZlclxuICApIHtcbiAgICBsZXQgcGFzdGVJZCA9IChNYXRoLnJhbmRvbSgpICsgMSkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCA1KTtcbiAgICB0aGlzLmluc2VydFRlbXBvcmFyeVRleHQoZWRpdG9yLCBwYXN0ZUlkKTtcbiAgICBjb25zdCBuYW1lID0gY2xpcGJvYXJkRGF0YS5maWxlc1swXS5uYW1lO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHVybCA9IGF3YWl0IGNhbGxiYWNrKGVkaXRvciwgcGFzdGVJZCk7XG4gICAgICB0aGlzLmVtYmVkTWFya0Rvd25JbWFnZShlZGl0b3IsIHBhc3RlSWQsIHVybCwgbmFtZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5oYW5kbGVGYWlsZWRVcGxvYWQoZWRpdG9yLCBwYXN0ZUlkLCBlKTtcbiAgICB9XG4gIH1cblxuICBpbnNlcnRUZW1wb3JhcnlUZXh0KGVkaXRvcjogRWRpdG9yLCBwYXN0ZUlkOiBzdHJpbmcpIHtcbiAgICBsZXQgcHJvZ3Jlc3NUZXh0ID0gaW1hZ2VBdXRvVXBsb2FkUGx1Z2luLnByb2dyZXNzVGV4dEZvcihwYXN0ZUlkKTtcbiAgICBlZGl0b3IucmVwbGFjZVNlbGVjdGlvbihwcm9ncmVzc1RleHQgKyBcIlxcblwiKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIHByb2dyZXNzVGV4dEZvcihpZDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGAhW1VwbG9hZGluZyBmaWxlLi4uJHtpZH1dKClgO1xuICB9XG5cbiAgZW1iZWRNYXJrRG93bkltYWdlKFxuICAgIGVkaXRvcjogRWRpdG9yLFxuICAgIHBhc3RlSWQ6IHN0cmluZyxcbiAgICBpbWFnZVVybDogYW55LFxuICAgIG5hbWU6IHN0cmluZyA9IFwiXCJcbiAgKSB7XG4gICAgbGV0IHByb2dyZXNzVGV4dCA9IGltYWdlQXV0b1VwbG9hZFBsdWdpbi5wcm9ncmVzc1RleHRGb3IocGFzdGVJZCk7XG4gICAgY29uc3QgaW1hZ2VOYW1lID0gdGhpcy5oYW5kbGVOYW1lKG5hbWUpO1xuXG4gICAgbGV0IG1hcmtEb3duSW1hZ2UgPSBnZXRFbWJlZE1hcmtkb3duKG5hbWUsIGltYWdlVXJsLCBpbWFnZU5hbWUpO1xuXG4gICAgaW1hZ2VBdXRvVXBsb2FkUGx1Z2luLnJlcGxhY2VGaXJzdE9jY3VycmVuY2UoXG4gICAgICBlZGl0b3IsXG4gICAgICBwcm9ncmVzc1RleHQsXG4gICAgICBtYXJrRG93bkltYWdlXG4gICAgKTtcbiAgfVxuXG4gIGhhbmRsZUZhaWxlZFVwbG9hZChlZGl0b3I6IEVkaXRvciwgcGFzdGVJZDogc3RyaW5nLCByZWFzb246IGFueSkge1xuICAgIG5ldyBOb3RpY2UocmVhc29uKTtcbiAgICBjb25zb2xlLmVycm9yKFwiRmFpbGVkIHJlcXVlc3Q6IFwiLCByZWFzb24pO1xuICAgIGxldCBwcm9ncmVzc1RleHQgPSBpbWFnZUF1dG9VcGxvYWRQbHVnaW4ucHJvZ3Jlc3NUZXh0Rm9yKHBhc3RlSWQpO1xuICAgIGltYWdlQXV0b1VwbG9hZFBsdWdpbi5yZXBsYWNlRmlyc3RPY2N1cnJlbmNlKFxuICAgICAgZWRpdG9yLFxuICAgICAgcHJvZ3Jlc3NUZXh0LFxuICAgICAgXCLimqDvuI91cGxvYWQgZmFpbGVkLCBjaGVjayBkZXYgY29uc29sZVwiXG4gICAgKTtcbiAgfVxuXG4gIGhhbmRsZU5hbWUobmFtZTogc3RyaW5nKSB7XG4gICAgY29uc3QgaW1hZ2VTaXplU3VmZml4ID0gdGhpcy5zZXR0aW5ncy5pbWFnZVNpemVTdWZmaXggfHwgXCJcIjtcblxuICAgIGlmICh0aGlzLnNldHRpbmdzLmltYWdlRGVzYyA9PT0gXCJvcmlnaW5cIikge1xuICAgICAgcmV0dXJuIGAke25hbWV9JHtpbWFnZVNpemVTdWZmaXh9YDtcbiAgICB9IGVsc2UgaWYgKHRoaXMuc2V0dGluZ3MuaW1hZ2VEZXNjID09PSBcIm5vbmVcIikge1xuICAgICAgcmV0dXJuIFwiXCI7XG4gICAgfSBlbHNlIGlmICh0aGlzLnNldHRpbmdzLmltYWdlRGVzYyA9PT0gXCJyZW1vdmVEZWZhdWx0XCIpIHtcbiAgICAgIGlmIChuYW1lID09PSBcImltYWdlLnBuZ1wiKSB7XG4gICAgICAgIHJldHVybiBcIlwiO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGAke25hbWV9JHtpbWFnZVNpemVTdWZmaXh9YDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGAke25hbWV9JHtpbWFnZVNpemVTdWZmaXh9YDtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgcmVwbGFjZUZpcnN0T2NjdXJyZW5jZShcbiAgICBlZGl0b3I6IEVkaXRvcixcbiAgICB0YXJnZXQ6IHN0cmluZyxcbiAgICByZXBsYWNlbWVudDogc3RyaW5nXG4gICkge1xuICAgIGxldCBsaW5lcyA9IGVkaXRvci5nZXRWYWx1ZSgpLnNwbGl0KFwiXFxuXCIpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBjaCA9IGxpbmVzW2ldLmluZGV4T2YodGFyZ2V0KTtcbiAgICAgIGlmIChjaCAhPSAtMSkge1xuICAgICAgICBsZXQgZnJvbSA9IHsgbGluZTogaSwgY2g6IGNoIH07XG4gICAgICAgIGxldCB0byA9IHsgbGluZTogaSwgY2g6IGNoICsgdGFyZ2V0Lmxlbmd0aCB9O1xuICAgICAgICBlZGl0b3IucmVwbGFjZVJhbmdlKHJlcGxhY2VtZW50LCBmcm9tLCB0byk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGNoZWNrRm9yVXBkYXRlKCk6IFByb21pc2U8eyBoYXNVcGRhdGU6IGJvb2xlYW47IHZlcnNpb246IHN0cmluZzsgZXJyb3I/OiBzdHJpbmcgfT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke0dJVEhVQl9SQVdfQkFTRX0vbWFuaWZlc3QuanNvbmApO1xuXG4gICAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDQpIHtcbiAgICAgICAgcmV0dXJuIHsgaGFzVXBkYXRlOiBmYWxzZSwgdmVyc2lvbjogXCJcIiwgZXJyb3I6IFwibm90X2ZvdW5kXCIgfTtcbiAgICAgIH1cbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgICAgcmV0dXJuIHsgaGFzVXBkYXRlOiBmYWxzZSwgdmVyc2lvbjogXCJcIiwgZXJyb3I6IGDor7fmsYLlpLHotKXvvJoke3Jlc3BvbnNlLnN0YXR1c31gIH07XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlbW90ZU1hbmlmZXN0ID0gKGF3YWl0IHJlc3BvbnNlLmpzb24oKSkgYXMgeyB2ZXJzaW9uPzogc3RyaW5nIH07XG4gICAgICBjb25zdCByZW1vdGVWZXJzaW9uID0gcmVtb3RlTWFuaWZlc3QudmVyc2lvbiA/PyBcIlwiO1xuICAgICAgaWYgKCFyZW1vdGVWZXJzaW9uKSB7XG4gICAgICAgIHJldHVybiB7IGhhc1VwZGF0ZTogZmFsc2UsIHZlcnNpb246IFwiXCIsIGVycm9yOiBcIui/nOerr+eJiOacrOWPt+aXoOaViFwiIH07XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGN1cnJlbnRWZXJzaW9uID0gdGhpcy5tYW5pZmVzdC52ZXJzaW9uO1xuICAgICAgY29uc3QgaGFzVXBkYXRlID0gdGhpcy5jb21wYXJlVmVyc2lvbnMocmVtb3RlVmVyc2lvbiwgY3VycmVudFZlcnNpb24pID4gMDtcbiAgICAgIHJldHVybiB7IGhhc1VwZGF0ZSwgdmVyc2lvbjogcmVtb3RlVmVyc2lvbiB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4geyBoYXNVcGRhdGU6IGZhbHNlLCB2ZXJzaW9uOiBcIlwiLCBlcnJvcjogU3RyaW5nKGVycm9yKSB9O1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHBlcmZvcm1VcGRhdGUodmVyc2lvbjogc3RyaW5nLCBvblByb2dyZXNzPzogKHN0ZXA6IG51bWJlciwgdG90YWw6IG51bWJlcikgPT4gdm9pZCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMuZG93bmxvYWRBbmRXcml0ZVVwZGF0ZUZpbGVzKHZlcnNpb24sIG9uUHJvZ3Jlc3MpO1xuICAgIGF3YWl0IHRoaXMucmVsb2FkUGx1Z2luKHZlcnNpb24sIGZhbHNlKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZG93bmxvYWRBbmRXcml0ZVVwZGF0ZUZpbGVzKFxuICAgIHZlcnNpb246IHN0cmluZyxcbiAgICBvblByb2dyZXNzPzogKHN0ZXA6IG51bWJlciwgdG90YWw6IG51bWJlcikgPT4gdm9pZFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBmaWxlcyA9IFtcIm1haW4uanNcIiwgXCJtYW5pZmVzdC5qc29uXCIsIFwic3R5bGVzLmNzc1wiXSBhcyBjb25zdDtcbiAgICBjb25zdCBjb250ZW50czogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuXG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGZpbGVzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgY29uc3QgZmlsZSA9IGZpbGVzW2luZGV4XTtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7R0lUSFVCX1JBV19CQVNFfS8ke2ZpbGV9YCk7XG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihg5LiL6L29ICR7ZmlsZX0g5aSx6LSl77yaJHtyZXNwb25zZS5zdGF0dXN9YCk7XG4gICAgICB9XG4gICAgICBjb250ZW50c1tmaWxlXSA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcbiAgICAgIG9uUHJvZ3Jlc3M/LihpbmRleCArIDEsIGZpbGVzLmxlbmd0aCk7XG4gICAgfVxuXG4gICAgY29uc3QgcGx1Z2luRGlyID0gdGhpcy5tYW5pZmVzdC5kaXI7XG4gICAgaWYgKCFwbHVnaW5EaXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIuaXoOazleiOt+WPluaPkuS7tuebruW9lVwiKTtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5hZGFwdGVyLndyaXRlKGAke3BsdWdpbkRpcn0vbWFpbi5qc2AsIGNvbnRlbnRzW1wibWFpbi5qc1wiXSk7XG4gICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZShgJHtwbHVnaW5EaXJ9L21hbmlmZXN0Lmpzb25gLCBjb250ZW50c1tcIm1hbmlmZXN0Lmpzb25cIl0pO1xuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoYCR7cGx1Z2luRGlyfS9zdHlsZXMuY3NzYCwgY29udGVudHNbXCJzdHlsZXMuY3NzXCJdKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVsb2FkUGx1Z2luKHZlcnNpb246IHN0cmluZywgYXV0byA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcGx1Z2luSWQgPSB0aGlzLm1hbmlmZXN0LmlkO1xuICAgIGNvbnN0IGFwcCA9IHRoaXMuYXBwO1xuXG4gICAgaWYgKGF1dG8pIHtcbiAgICAgIC8vIEB0cy1pZ25vcmUg4oCUIOWGhemDqCBBUElcbiAgICAgIGNvbnN0IHNldHRpbmcgPSBhcHAuc2V0dGluZztcbiAgICAgIGlmIChzZXR0aW5nICYmIHNldHRpbmcuYWN0aXZlVGFiPy5pZCA9PT0gcGx1Z2luSWQpIHtcbiAgICAgICAgdGhpcy5wZW5kaW5nQXV0b1JlbG9hZFZlcnNpb24gPSB2ZXJzaW9uO1xuICAgICAgICB0aGlzLndhdGNoUGVuZGluZ0F1dG9SZWxvYWQoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIG5ldyBOb3RpY2UoYXV0byA/IGDlj5HnjrDmlrDniYjmnKzvvIgke3ZlcnNpb25977yJ77yM5q2j5Zyo6Ieq5Yqo5pu05pawLi4uYCA6IGDmm7TmlrDlrozmiJDvvIgke3ZlcnNpb25977yJ77yM5q2j5Zyo6YeN6L295o+S5Lu2Li4uYCk7XG5cbiAgICB3aW5kb3cuc2V0VGltZW91dChhc3luYyAoKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyBAdHMtaWdub3JlIOKAlCDlhoXpg6ggQVBJXG4gICAgICAgIGF3YWl0IGFwcC5wbHVnaW5zLnVubG9hZFBsdWdpbihwbHVnaW5JZCk7XG4gICAgICAgIC8vIEB0cy1pZ25vcmUg4oCUIOWGhemDqCBBUElcbiAgICAgICAgZGVsZXRlIGFwcC5wbHVnaW5zLm1hbmlmZXN0c1twbHVnaW5JZF07XG5cbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIDMwMCkpO1xuXG4gICAgICAgIC8vIEB0cy1pZ25vcmUg4oCUIOWGhemDqCBBUElcbiAgICAgICAgYXdhaXQgYXBwLnBsdWdpbnMubG9hZE1hbmlmZXN0cygpO1xuXG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCAzMDApKTtcblxuICAgICAgICAvLyBAdHMtaWdub3JlIOKAlCDlhoXpg6ggQVBJXG4gICAgICAgIGF3YWl0IGFwcC5wbHVnaW5zLmxvYWRQbHVnaW4ocGx1Z2luSWQpO1xuICAgICAgICAvLyBAdHMtaWdub3JlIOKAlCDlhoXpg6ggQVBJXG4gICAgICAgIGF3YWl0IGFwcC5wbHVnaW5zLmVuYWJsZVBsdWdpbihwbHVnaW5JZCk7XG5cbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHdpbmRvdy5zZXRUaW1lb3V0KHJlc29sdmUsIDUwMCkpO1xuXG4gICAgICAgIC8vIEB0cy1pZ25vcmUg4oCUIOWGhemDqCBBUElcbiAgICAgICAgYXBwLnNldHRpbmcub3BlbigpO1xuICAgICAgICAvLyBAdHMtaWdub3JlIOKAlCDlhoXpg6ggQVBJXG4gICAgICAgIGFwcC5zZXR0aW5nLm9wZW5UYWJCeUlkKHBsdWdpbklkKTtcblxuICAgICAgICBuZXcgTm90aWNlKGF1dG8gPyBg5o+S5Lu25bey6Ieq5Yqo5pu05paw5YiwICR7dmVyc2lvbn1gIDogYOaPkuS7tuW3sumHjei9veWIsCAke3ZlcnNpb259YCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbZmlsZS1hdXRvLXVwbG9hZC1wbHVnaW5dIOmHjei9veWksei0pTpcIiwgZSk7XG4gICAgICAgIG5ldyBOb3RpY2UoXCLoh6rliqjph43ovb3lpLHotKXvvIzor7fngrnlh7vlt7Llronoo4Xmj5Lku7bpobXnmoTjgIzph43mlrDliqDovb3mj5Lku7bjgI3mjInpkq5cIik7XG4gICAgICB9XG4gICAgfSwgMTAwKTtcbiAgfVxuXG4gIHByaXZhdGUgd2F0Y2hQZW5kaW5nQXV0b1JlbG9hZCgpIHtcbiAgICB0aGlzLmNsZWFyUGVuZGluZ0F1dG9SZWxvYWRUaW1lcigpO1xuICAgIHRoaXMucGVuZGluZ0F1dG9SZWxvYWRUaW1lciA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBjb25zdCBwbHVnaW5JZCA9IHRoaXMubWFuaWZlc3QuaWQ7XG4gICAgICAvLyBAdHMtaWdub3JlIOKAlCDlhoXpg6ggQVBJXG4gICAgICBjb25zdCBzZXR0aW5nID0gdGhpcy5hcHAuc2V0dGluZztcbiAgICAgIGlmICghc2V0dGluZyB8fCBzZXR0aW5nLmFjdGl2ZVRhYj8uaWQgIT09IHBsdWdpbklkKSB7XG4gICAgICAgIHRoaXMuY2xlYXJQZW5kaW5nQXV0b1JlbG9hZFRpbWVyKCk7XG4gICAgICAgIGNvbnN0IHZlcnNpb24gPSB0aGlzLnBlbmRpbmdBdXRvUmVsb2FkVmVyc2lvbjtcbiAgICAgICAgdGhpcy5wZW5kaW5nQXV0b1JlbG9hZFZlcnNpb24gPSBcIlwiO1xuICAgICAgICBpZiAodmVyc2lvbikge1xuICAgICAgICAgIHZvaWQgdGhpcy5yZWxvYWRQbHVnaW4odmVyc2lvbiwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LCAxMDAwKTtcbiAgfVxuXG4gIHByaXZhdGUgY2xlYXJBdXRvVXBkYXRlQ2hlY2tUaW1lcigpIHtcbiAgICBpZiAodGhpcy5hdXRvVXBkYXRlQ2hlY2tUaW1lciAhPT0gbnVsbCkge1xuICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLmF1dG9VcGRhdGVDaGVja1RpbWVyKTtcbiAgICAgIHRoaXMuYXV0b1VwZGF0ZUNoZWNrVGltZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY2xlYXJQZW5kaW5nQXV0b1JlbG9hZFRpbWVyKCkge1xuICAgIGlmICh0aGlzLnBlbmRpbmdBdXRvUmVsb2FkVGltZXIgIT09IG51bGwpIHtcbiAgICAgIHdpbmRvdy5jbGVhckludGVydmFsKHRoaXMucGVuZGluZ0F1dG9SZWxvYWRUaW1lcik7XG4gICAgICB0aGlzLnBlbmRpbmdBdXRvUmVsb2FkVGltZXIgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgc2NoZWR1bGVBdXRvVXBkYXRlQ2hlY2soKSB7XG4gICAgdGhpcy5jbGVhckF1dG9VcGRhdGVDaGVja1RpbWVyKCk7XG4gICAgdGhpcy5hdXRvVXBkYXRlQ2hlY2tUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHZvaWQgdGhpcy5ydW5BdXRvVXBkYXRlQ2hlY2soKTtcbiAgICAgIHRoaXMucmVnaXN0ZXJJbnRlcnZhbChcbiAgICAgICAgd2luZG93LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgICB2b2lkIHRoaXMucnVuQXV0b1VwZGF0ZUNoZWNrKCk7XG4gICAgICAgIH0sIDYwICogNjAgKiAxMDAwKVxuICAgICAgKTtcbiAgICB9LCAzMCAqIDEwMDApO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBydW5BdXRvVXBkYXRlQ2hlY2soKSB7XG4gICAgaWYgKCF0aGlzLnNldHRpbmdzLmF1dG9VcGRhdGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNoZWNrRm9yVXBkYXRlKCk7XG4gICAgaWYgKHJlc3VsdC5lcnJvciB8fCAhcmVzdWx0Lmhhc1VwZGF0ZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZvaWQgdGhpcy5wZXJmb3JtQXV0b1VwZGF0ZShyZXN1bHQudmVyc2lvbik7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHBlcmZvcm1BdXRvVXBkYXRlKHZlcnNpb246IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBuZXcgTm90aWNlKGDlj5HnjrDmlrDniYjmnKwgJHt2ZXJzaW9ufe+8jOato+WcqOiHquWKqOabtOaWsC4uLmApO1xuICAgICAgYXdhaXQgdGhpcy5kb3dubG9hZEFuZFdyaXRlVXBkYXRlRmlsZXModmVyc2lvbik7XG4gICAgICBhd2FpdCB0aGlzLnJlbG9hZFBsdWdpbih2ZXJzaW9uLCB0cnVlKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcIltmaWxlLWF1dG8tdXBsb2FkLXBsdWdpbl0g6Ieq5Yqo5pu05paw5aSx6LSlOlwiLCBlcnJvcik7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjb21wYXJlVmVyc2lvbnModjE6IHN0cmluZywgdjI6IHN0cmluZyk6IG51bWJlciB7XG4gICAgY29uc3QgcGFyc2VWZXJzaW9uID0gKHZlcnNpb246IHN0cmluZyk6IG51bWJlcltdID0+IHtcbiAgICAgIHJldHVybiB2ZXJzaW9uXG4gICAgICAgIC5yZXBsYWNlKC9edi8sIFwiXCIpXG4gICAgICAgIC5zcGxpdChcIi5cIilcbiAgICAgICAgLm1hcCgocGFydCkgPT4ge1xuICAgICAgICAgIGNvbnN0IG1hdGNoID0gL15cXGQrLy5leGVjKHBhcnQpO1xuICAgICAgICAgIHJldHVybiBtYXRjaCA/IHBhcnNlSW50KG1hdGNoWzBdLCAxMCkgOiAwO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgY29uc3QgcGFydHMxID0gcGFyc2VWZXJzaW9uKHYxKTtcbiAgICBjb25zdCBwYXJ0czIgPSBwYXJzZVZlcnNpb24odjIpO1xuICAgIGNvbnN0IG1heExlbmd0aCA9IE1hdGgubWF4KHBhcnRzMS5sZW5ndGgsIHBhcnRzMi5sZW5ndGgpO1xuXG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IG1heExlbmd0aDsgaW5kZXgrKykge1xuICAgICAgY29uc3QgYSA9IHBhcnRzMVtpbmRleF0gPz8gMDtcbiAgICAgIGNvbnN0IGIgPSBwYXJ0czJbaW5kZXhdID8/IDA7XG4gICAgICBpZiAoYSA+IGIpIHJldHVybiAxO1xuICAgICAgaWYgKGEgPCBiKSByZXR1cm4gLTE7XG4gICAgfVxuICAgIHJldHVybiAwO1xuICB9XG59XG4iXSwibmFtZXMiOlsiY29yZSIsImdsb2JhbCIsInJlcXVpcmUkJDEiLCJyZXF1aXJlJCQyIiwiaXNleGUiLCJwYXRoIiwicmVxdWlyZSQkMCIsIndoaWNoIiwicGF0aEtleU1vZHVsZSIsInJlc29sdmVDb21tYW5kIiwic2hlYmFuZ1JlZ2V4Iiwic2hlYmFuZ0NvbW1hbmQiLCJyZWFkU2hlYmFuZyIsInJlcXVpcmUkJDMiLCJpc1dpbiIsInBhcnNlIiwiZW5vZW50IiwiY3Jvc3NTcGF3bk1vZHVsZSIsInN0cmlwRmluYWxOZXdsaW5lIiwibWltaWNGbiIsIm1pbWljRm5Nb2R1bGUiLCJvbmV0aW1lIiwib25ldGltZU1vZHVsZSIsInNpZ25hbHMiLCJfb3MiLCJfcmVhbHRpbWUiLCJzaWduYWxzQnlOYW1lIiwibWFrZUVycm9yIiwibm9ybWFsaXplU3RkaW8iLCJzdGRpb01vZHVsZSIsInByb2Nlc3MiLCJzaWduYWxFeGl0TW9kdWxlIiwic3Bhd25lZEtpbGwiLCJzcGF3bmVkQ2FuY2VsIiwic2V0dXBUaW1lb3V0IiwidmFsaWRhdGVUaW1lb3V0Iiwic2V0RXhpdEhhbmRsZXIiLCJpc1N0cmVhbSIsImJ1ZmZlclN0cmVhbSIsInN0cmVhbSIsImdldFN0cmVhbSIsImdldFN0cmVhbU1vZHVsZSIsIm1lcmdlU3RyZWFtIiwiaGFuZGxlSW5wdXQiLCJtYWtlQWxsU3RyZWFtIiwiZ2V0U3Bhd25lZFJlc3VsdCIsInZhbGlkYXRlSW5wdXRTeW5jIiwibWVyZ2VQcm9taXNlIiwiZ2V0U3Bhd25lZFByb21pc2UiLCJqb2luQ29tbWFuZCIsImdldEVzY2FwZWRDb21tYW5kIiwicGFyc2VDb21tYW5kIiwicmVxdWlyZSQkNCIsInJlcXVpcmUkJDUiLCJyZXF1aXJlJCQ2IiwicmVxdWlyZSQkNyIsInJlcXVpcmUkJDgiLCJyZXF1aXJlJCQ5IiwicmVxdWlyZSQkMTAiLCJyZXF1aXJlJCQxMSIsImV4ZWNhTW9kdWxlIiwidXNlckluZm8iLCJleGVjYSIsImV4dG5hbWUiLCJzZXRJY29uIiwiTm90aWNlIiwiTW9kYWwiLCJXaWRnZXRUeXBlIiwiU3RhdGVGaWVsZCIsIkVkaXRvclZpZXciLCJzdGF0ZSIsIlJhbmdlU2V0QnVpbGRlciIsInN5bnRheFRyZWUiLCJEZWNvcmF0aW9uIiwiQnVmZmVyIiwic3RydG9rMy5mcm9tQnVmZmVyIiwic3RydG9rMy5mcm9tU3RyZWFtIiwic3RydG9rMy5FbmRPZlN0cmVhbUVycm9yIiwiVG9rZW4uU3RyaW5nVHlwZSIsIlRva2VuLlVJTlQ4IiwiVG9rZW4uSU5UMzJfQkUiLCJUb2tlbi5VSU5UNjRfTEUiLCJUb2tlbi5VSU5UMTZfQkUiLCJUb2tlbi5VSU5UMTZfTEUiLCJUb2tlbi5VSU5UMzJfQkUiLCJUb2tlbi5VSU5UMzJfTEUiLCJtb21lbnQiLCJub3JtYWxpemVQYXRoIiwicmVsYXRpdmUiLCJyZXF1ZXN0VXJsIiwiam9pbiIsInJlYWRGaWxlIiwiZXhlYyIsIk1hcmtkb3duVmlldyIsIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIiwiUGx1Z2luIiwiYWRkSWNvbiIsIlRGaWxlIiwiYmFzZW5hbWUiLCJ1bmxpbmsiLCJyZXNvbHZlIiwiZGlybmFtZSIsImV4aXN0c1N5bmMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBMEJBLFNBQVMsVUFBVSxDQUFDLElBQUksRUFBRTtBQUMxQixFQUFFLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFO0FBQ2hDLElBQUksTUFBTSxJQUFJLFNBQVMsQ0FBQyxrQ0FBa0MsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDbkYsR0FBRztBQUNILENBQUM7QUFDRDtBQUNBO0FBQ0EsU0FBUyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO0FBQ3BELEVBQUUsSUFBSSxHQUFHLEdBQUcsRUFBRSxDQUFDO0FBQ2YsRUFBRSxJQUFJLGlCQUFpQixHQUFHLENBQUMsQ0FBQztBQUM1QixFQUFFLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3JCLEVBQUUsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQ2YsRUFBRSxJQUFJLElBQUksQ0FBQztBQUNYLEVBQUUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUU7QUFDekMsSUFBSSxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTTtBQUN2QixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hDLFNBQVMsSUFBSSxJQUFJLEtBQUssRUFBRTtBQUN4QixNQUFNLE1BQU07QUFDWjtBQUNBLE1BQU0sSUFBSSxHQUFHLEVBQUUsT0FBTztBQUN0QixJQUFJLElBQUksSUFBSSxLQUFLLEVBQUUsUUFBUTtBQUMzQixNQUFNLElBQUksU0FBUyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsRUFBRSxDQUV0QyxNQUFNLElBQUksU0FBUyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsRUFBRTtBQUNwRCxRQUFRLElBQUksR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksaUJBQWlCLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxFQUFFLFVBQVUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUTtBQUNySixVQUFVLElBQUksR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDOUIsWUFBWSxJQUFJLGNBQWMsR0FBRyxHQUFHLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3RELFlBQVksSUFBSSxjQUFjLEtBQUssR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDbkQsY0FBYyxJQUFJLGNBQWMsS0FBSyxDQUFDLENBQUMsRUFBRTtBQUN6QyxnQkFBZ0IsR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUN6QixnQkFBZ0IsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO0FBQ3RDLGVBQWUsTUFBTTtBQUNyQixnQkFBZ0IsR0FBRyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDO0FBQ25ELGdCQUFnQixpQkFBaUIsR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzFFLGVBQWU7QUFDZixjQUFjLFNBQVMsR0FBRyxDQUFDLENBQUM7QUFDNUIsY0FBYyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLGNBQWMsU0FBUztBQUN2QixhQUFhO0FBQ2IsV0FBVyxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDM0QsWUFBWSxHQUFHLEdBQUcsRUFBRSxDQUFDO0FBQ3JCLFlBQVksaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO0FBQ2xDLFlBQVksU0FBUyxHQUFHLENBQUMsQ0FBQztBQUMxQixZQUFZLElBQUksR0FBRyxDQUFDLENBQUM7QUFDckIsWUFBWSxTQUFTO0FBQ3JCLFdBQVc7QUFDWCxTQUFTO0FBQ1QsUUFBUSxJQUFJLGNBQWMsRUFBRTtBQUM1QixVQUFVLElBQUksR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDO0FBQzVCLFlBQVksR0FBRyxJQUFJLEtBQUssQ0FBQztBQUN6QjtBQUNBLFlBQVksR0FBRyxHQUFHLElBQUksQ0FBQztBQUN2QixVQUFVLGlCQUFpQixHQUFHLENBQUMsQ0FBQztBQUNoQyxTQUFTO0FBQ1QsT0FBTyxNQUFNO0FBQ2IsUUFBUSxJQUFJLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQztBQUMxQixVQUFVLEdBQUcsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3BEO0FBQ0EsVUFBVSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzdDLFFBQVEsaUJBQWlCLEdBQUcsQ0FBQyxHQUFHLFNBQVMsR0FBRyxDQUFDLENBQUM7QUFDOUMsT0FBTztBQUNQLE1BQU0sU0FBUyxHQUFHLENBQUMsQ0FBQztBQUNwQixNQUFNLElBQUksR0FBRyxDQUFDLENBQUM7QUFDZixLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRSxVQUFVLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRTtBQUNqRCxNQUFNLEVBQUUsSUFBSSxDQUFDO0FBQ2IsS0FBSyxNQUFNO0FBQ1gsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDaEIsS0FBSztBQUNMLEdBQUc7QUFDSCxFQUFFLE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUNEO0FBQ0EsU0FBUyxPQUFPLENBQUMsR0FBRyxFQUFFLFVBQVUsRUFBRTtBQUNsQyxFQUFFLElBQUksR0FBRyxHQUFHLFVBQVUsQ0FBQyxHQUFHLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQztBQUM5QyxFQUFFLElBQUksSUFBSSxHQUFHLFVBQVUsQ0FBQyxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxJQUFJLEVBQUUsS0FBSyxVQUFVLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQ2pGLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtBQUNaLElBQUksT0FBTyxJQUFJLENBQUM7QUFDaEIsR0FBRztBQUNILEVBQUUsSUFBSSxHQUFHLEtBQUssVUFBVSxDQUFDLElBQUksRUFBRTtBQUMvQixJQUFJLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQztBQUN0QixHQUFHO0FBQ0gsRUFBRSxPQUFPLEdBQUcsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDO0FBQzFCLENBQUM7QUFDRDtBQUNBLElBQUksS0FBSyxHQUFHO0FBQ1o7QUFDQSxFQUFFLE9BQU8sRUFBRSxTQUFTLE9BQU8sR0FBRztBQUM5QixJQUFJLElBQUksWUFBWSxHQUFHLEVBQUUsQ0FBQztBQUMxQixJQUFJLElBQUksZ0JBQWdCLEdBQUcsS0FBSyxDQUFDO0FBQ2pDLElBQUksSUFBSSxHQUFHLENBQUM7QUFDWjtBQUNBLElBQUksS0FBSyxJQUFJLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUMxRSxNQUFNLElBQUksSUFBSSxDQUFDO0FBQ2YsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQ2hCLFFBQVEsSUFBSSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM1QixXQUFXO0FBQ1gsUUFBUSxJQUFJLEdBQUcsS0FBSyxTQUFTO0FBQzdCLFVBQVUsR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUM5QixRQUFRLElBQUksR0FBRyxHQUFHLENBQUM7QUFDbkIsT0FBTztBQUNQO0FBQ0EsTUFBTSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDdkI7QUFDQTtBQUNBLE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUM3QixRQUFRLFNBQVM7QUFDakIsT0FBTztBQUNQO0FBQ0EsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEdBQUcsR0FBRyxZQUFZLENBQUM7QUFDL0MsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsT0FBTztBQUN6RCxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUksWUFBWSxHQUFHLG9CQUFvQixDQUFDLFlBQVksRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUM7QUFDekU7QUFDQSxJQUFJLElBQUksZ0JBQWdCLEVBQUU7QUFDMUIsTUFBTSxJQUFJLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQztBQUNqQyxRQUFRLE9BQU8sR0FBRyxHQUFHLFlBQVksQ0FBQztBQUNsQztBQUNBLFFBQVEsT0FBTyxHQUFHLENBQUM7QUFDbkIsS0FBSyxNQUFNLElBQUksWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDeEMsTUFBTSxPQUFPLFlBQVksQ0FBQztBQUMxQixLQUFLLE1BQU07QUFDWCxNQUFNLE9BQU8sR0FBRyxDQUFDO0FBQ2pCLEtBQUs7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLFNBQVMsRUFBRSxTQUFTLFNBQVMsQ0FBQyxJQUFJLEVBQUU7QUFDdEMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckI7QUFDQSxJQUFJLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsT0FBTyxHQUFHLENBQUM7QUFDdEM7QUFDQSxJQUFJLElBQUksVUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxPQUFPO0FBQ3JELElBQUksSUFBSSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRSxPQUFPO0FBQzFFO0FBQ0E7QUFDQSxJQUFJLElBQUksR0FBRyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNuRDtBQUNBLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxJQUFJLEdBQUcsR0FBRyxDQUFDO0FBQ3JELElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxpQkFBaUIsRUFBRSxJQUFJLElBQUksR0FBRyxDQUFDO0FBQzFEO0FBQ0EsSUFBSSxJQUFJLFVBQVUsRUFBRSxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUM7QUFDdEMsSUFBSSxPQUFPLElBQUksQ0FBQztBQUNoQixHQUFHO0FBQ0g7QUFDQSxFQUFFLFVBQVUsRUFBRSxTQUFTLFVBQVUsQ0FBQyxJQUFJLEVBQUU7QUFDeEMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckIsSUFBSSxPQUFPLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxPQUFPO0FBQzlELEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxFQUFFLFNBQVMsSUFBSSxHQUFHO0FBQ3hCLElBQUksSUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUM7QUFDOUIsTUFBTSxPQUFPLEdBQUcsQ0FBQztBQUNqQixJQUFJLElBQUksTUFBTSxDQUFDO0FBQ2YsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtBQUMvQyxNQUFNLElBQUksR0FBRyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM3QixNQUFNLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN0QixNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDMUIsUUFBUSxJQUFJLE1BQU0sS0FBSyxTQUFTO0FBQ2hDLFVBQVUsTUFBTSxHQUFHLEdBQUcsQ0FBQztBQUN2QjtBQUNBLFVBQVUsTUFBTSxJQUFJLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDOUIsT0FBTztBQUNQLEtBQUs7QUFDTCxJQUFJLElBQUksTUFBTSxLQUFLLFNBQVM7QUFDNUIsTUFBTSxPQUFPLEdBQUcsQ0FBQztBQUNqQixJQUFJLE9BQU8sS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNuQyxHQUFHO0FBQ0g7QUFDQSxFQUFFLFFBQVEsRUFBRSxTQUFTLFFBQVEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFO0FBQ3hDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3JCLElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ25CO0FBQ0EsSUFBSSxJQUFJLElBQUksS0FBSyxFQUFFLEVBQUUsT0FBTyxFQUFFLENBQUM7QUFDL0I7QUFDQSxJQUFJLElBQUksR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQy9CLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDM0I7QUFDQSxJQUFJLElBQUksSUFBSSxLQUFLLEVBQUUsRUFBRSxPQUFPLEVBQUUsQ0FBQztBQUMvQjtBQUNBO0FBQ0EsSUFBSSxJQUFJLFNBQVMsR0FBRyxDQUFDLENBQUM7QUFDdEIsSUFBSSxPQUFPLFNBQVMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsU0FBUyxFQUFFO0FBQ2pELE1BQU0sSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUU7QUFDM0MsUUFBUSxNQUFNO0FBQ2QsS0FBSztBQUNMLElBQUksSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztBQUM5QixJQUFJLElBQUksT0FBTyxHQUFHLE9BQU8sR0FBRyxTQUFTLENBQUM7QUFDdEM7QUFDQTtBQUNBLElBQUksSUFBSSxPQUFPLEdBQUcsQ0FBQyxDQUFDO0FBQ3BCLElBQUksT0FBTyxPQUFPLEdBQUcsRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLE9BQU8sRUFBRTtBQUMzQyxNQUFNLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFO0FBQ3ZDLFFBQVEsTUFBTTtBQUNkLEtBQUs7QUFDTCxJQUFJLElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUM7QUFDMUIsSUFBSSxJQUFJLEtBQUssR0FBRyxLQUFLLEdBQUcsT0FBTyxDQUFDO0FBQ2hDO0FBQ0E7QUFDQSxJQUFJLElBQUksTUFBTSxHQUFHLE9BQU8sR0FBRyxLQUFLLEdBQUcsT0FBTyxHQUFHLEtBQUssQ0FBQztBQUNuRCxJQUFJLElBQUksYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzNCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2QsSUFBSSxPQUFPLENBQUMsSUFBSSxNQUFNLEVBQUUsRUFBRSxDQUFDLEVBQUU7QUFDN0IsTUFBTSxJQUFJLENBQUMsS0FBSyxNQUFNLEVBQUU7QUFDeEIsUUFBUSxJQUFJLEtBQUssR0FBRyxNQUFNLEVBQUU7QUFDNUIsVUFBVSxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUTtBQUN2RDtBQUNBO0FBQ0EsWUFBWSxPQUFPLEVBQUUsQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUM3QyxXQUFXLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQzlCO0FBQ0E7QUFDQSxZQUFZLE9BQU8sRUFBRSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDekMsV0FBVztBQUNYLFNBQVMsTUFBTSxJQUFJLE9BQU8sR0FBRyxNQUFNLEVBQUU7QUFDckMsVUFBVSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUTtBQUMzRDtBQUNBO0FBQ0EsWUFBWSxhQUFhLEdBQUcsQ0FBQyxDQUFDO0FBQzlCLFdBQVcsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUU7QUFDOUI7QUFDQTtBQUNBLFlBQVksYUFBYSxHQUFHLENBQUMsQ0FBQztBQUM5QixXQUFXO0FBQ1gsU0FBUztBQUNULFFBQVEsTUFBTTtBQUNkLE9BQU87QUFDUCxNQUFNLElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3BELE1BQU0sSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDOUMsTUFBTSxJQUFJLFFBQVEsS0FBSyxNQUFNO0FBQzdCLFFBQVEsTUFBTTtBQUNkLFdBQVcsSUFBSSxRQUFRLEtBQUssRUFBRTtBQUM5QixRQUFRLGFBQWEsR0FBRyxDQUFDLENBQUM7QUFDMUIsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLEdBQUcsR0FBRyxFQUFFLENBQUM7QUFDakI7QUFDQTtBQUNBLElBQUksS0FBSyxDQUFDLEdBQUcsU0FBUyxHQUFHLGFBQWEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLE9BQU8sRUFBRSxFQUFFLENBQUMsRUFBRTtBQUMvRCxNQUFNLElBQUksQ0FBQyxLQUFLLE9BQU8sSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUTtBQUM1RCxRQUFRLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxDQUFDO0FBQzVCLFVBQVUsR0FBRyxJQUFJLElBQUksQ0FBQztBQUN0QjtBQUNBLFVBQVUsR0FBRyxJQUFJLEtBQUssQ0FBQztBQUN2QixPQUFPO0FBQ1AsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBLElBQUksSUFBSSxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUM7QUFDdEIsTUFBTSxPQUFPLEdBQUcsR0FBRyxFQUFFLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxhQUFhLENBQUMsQ0FBQztBQUNyRCxTQUFTO0FBQ1QsTUFBTSxPQUFPLElBQUksYUFBYSxDQUFDO0FBQy9CLE1BQU0sSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUU7QUFDdkMsUUFBUSxFQUFFLE9BQU8sQ0FBQztBQUNsQixNQUFNLE9BQU8sRUFBRSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUMvQixLQUFLO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxTQUFTLEVBQUUsU0FBUyxTQUFTLENBQUMsSUFBSSxFQUFFO0FBQ3RDLElBQUksT0FBTyxJQUFJLENBQUM7QUFDaEIsR0FBRztBQUNIO0FBQ0EsRUFBRSxPQUFPLEVBQUUsU0FBUyxPQUFPLENBQUMsSUFBSSxFQUFFO0FBQ2xDLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3JCLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxPQUFPLEdBQUcsQ0FBQztBQUN0QyxJQUFJLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEMsSUFBSSxJQUFJLE9BQU8sR0FBRyxJQUFJLEtBQUssRUFBRSxPQUFPO0FBQ3BDLElBQUksSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDakIsSUFBSSxJQUFJLFlBQVksR0FBRyxJQUFJLENBQUM7QUFDNUIsSUFBSSxLQUFLLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUU7QUFDL0MsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNoQyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsUUFBUTtBQUM3QixVQUFVLElBQUksQ0FBQyxZQUFZLEVBQUU7QUFDN0IsWUFBWSxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQ3BCLFlBQVksTUFBTTtBQUNsQixXQUFXO0FBQ1gsU0FBUyxNQUFNO0FBQ2Y7QUFDQSxRQUFRLFlBQVksR0FBRyxLQUFLLENBQUM7QUFDN0IsT0FBTztBQUNQLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUUsT0FBTyxPQUFPLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUMvQyxJQUFJLElBQUksT0FBTyxJQUFJLEdBQUcsS0FBSyxDQUFDLEVBQUUsT0FBTyxJQUFJLENBQUM7QUFDMUMsSUFBSSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzlCLEdBQUc7QUFDSDtBQUNBLEVBQUUsUUFBUSxFQUFFLFNBQVMsUUFBUSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUU7QUFDekMsSUFBSSxJQUFJLEdBQUcsS0FBSyxTQUFTLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxFQUFFLE1BQU0sSUFBSSxTQUFTLENBQUMsaUNBQWlDLENBQUMsQ0FBQztBQUM3RyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNyQjtBQUNBLElBQUksSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ2xCLElBQUksSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDakIsSUFBSSxJQUFJLFlBQVksR0FBRyxJQUFJLENBQUM7QUFDNUIsSUFBSSxJQUFJLENBQUMsQ0FBQztBQUNWO0FBQ0EsSUFBSSxJQUFJLEdBQUcsS0FBSyxTQUFTLElBQUksR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQzFFLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxNQUFNLElBQUksR0FBRyxLQUFLLElBQUksRUFBRSxPQUFPLEVBQUUsQ0FBQztBQUNoRSxNQUFNLElBQUksTUFBTSxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0FBQ2xDLE1BQU0sSUFBSSxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNoQyxNQUFNLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUU7QUFDN0MsUUFBUSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RDLFFBQVEsSUFBSSxJQUFJLEtBQUssRUFBRSxRQUFRO0FBQy9CO0FBQ0E7QUFDQSxZQUFZLElBQUksQ0FBQyxZQUFZLEVBQUU7QUFDL0IsY0FBYyxLQUFLLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM1QixjQUFjLE1BQU07QUFDcEIsYUFBYTtBQUNiLFdBQVcsTUFBTTtBQUNqQixVQUFVLElBQUksZ0JBQWdCLEtBQUssQ0FBQyxDQUFDLEVBQUU7QUFDdkM7QUFDQTtBQUNBLFlBQVksWUFBWSxHQUFHLEtBQUssQ0FBQztBQUNqQyxZQUFZLGdCQUFnQixHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDckMsV0FBVztBQUNYLFVBQVUsSUFBSSxNQUFNLElBQUksQ0FBQyxFQUFFO0FBQzNCO0FBQ0EsWUFBWSxJQUFJLElBQUksS0FBSyxHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxFQUFFO0FBQ2pELGNBQWMsSUFBSSxFQUFFLE1BQU0sS0FBSyxDQUFDLENBQUMsRUFBRTtBQUNuQztBQUNBO0FBQ0EsZ0JBQWdCLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFDeEIsZUFBZTtBQUNmLGFBQWEsTUFBTTtBQUNuQjtBQUNBO0FBQ0EsY0FBYyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDMUIsY0FBYyxHQUFHLEdBQUcsZ0JBQWdCLENBQUM7QUFDckMsYUFBYTtBQUNiLFdBQVc7QUFDWCxTQUFTO0FBQ1QsT0FBTztBQUNQO0FBQ0EsTUFBTSxJQUFJLEtBQUssS0FBSyxHQUFHLEVBQUUsR0FBRyxHQUFHLGdCQUFnQixDQUFDLEtBQUssSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUUsR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7QUFDdkYsTUFBTSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3BDLEtBQUssTUFBTTtBQUNYLE1BQU0sS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRTtBQUM3QyxRQUFRLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLFFBQVE7QUFDN0M7QUFDQTtBQUNBLFlBQVksSUFBSSxDQUFDLFlBQVksRUFBRTtBQUMvQixjQUFjLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzVCLGNBQWMsTUFBTTtBQUNwQixhQUFhO0FBQ2IsV0FBVyxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFO0FBQ2pDO0FBQ0E7QUFDQSxVQUFVLFlBQVksR0FBRyxLQUFLLENBQUM7QUFDL0IsVUFBVSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN0QixTQUFTO0FBQ1QsT0FBTztBQUNQO0FBQ0EsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQztBQUNoQyxNQUFNLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDcEMsS0FBSztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsT0FBTyxFQUFFLFNBQVMsT0FBTyxDQUFDLElBQUksRUFBRTtBQUNsQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNyQixJQUFJLElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3RCLElBQUksSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBQ3RCLElBQUksSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDakIsSUFBSSxJQUFJLFlBQVksR0FBRyxJQUFJLENBQUM7QUFDNUI7QUFDQTtBQUNBLElBQUksSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDO0FBQ3hCLElBQUksS0FBSyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFO0FBQy9DLE1BQU0sSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsUUFBUTtBQUM3QjtBQUNBO0FBQ0EsVUFBVSxJQUFJLENBQUMsWUFBWSxFQUFFO0FBQzdCLFlBQVksU0FBUyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDOUIsWUFBWSxNQUFNO0FBQ2xCLFdBQVc7QUFDWCxVQUFVLFNBQVM7QUFDbkIsU0FBUztBQUNULE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUU7QUFDdEI7QUFDQTtBQUNBLFFBQVEsWUFBWSxHQUFHLEtBQUssQ0FBQztBQUM3QixRQUFRLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3BCLE9BQU87QUFDUCxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsUUFBUTtBQUM3QjtBQUNBLFVBQVUsSUFBSSxRQUFRLEtBQUssQ0FBQyxDQUFDO0FBQzdCLFlBQVksUUFBUSxHQUFHLENBQUMsQ0FBQztBQUN6QixlQUFlLElBQUksV0FBVyxLQUFLLENBQUM7QUFDcEMsWUFBWSxXQUFXLEdBQUcsQ0FBQyxDQUFDO0FBQzVCLE9BQU8sTUFBTSxJQUFJLFFBQVEsS0FBSyxDQUFDLENBQUMsRUFBRTtBQUNsQztBQUNBO0FBQ0EsUUFBUSxXQUFXLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDekIsT0FBTztBQUNQLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxRQUFRLEtBQUssQ0FBQyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQztBQUNyQztBQUNBLFFBQVEsV0FBVyxLQUFLLENBQUM7QUFDekI7QUFDQSxRQUFRLFdBQVcsS0FBSyxDQUFDLElBQUksUUFBUSxLQUFLLEdBQUcsR0FBRyxDQUFDLElBQUksUUFBUSxLQUFLLFNBQVMsR0FBRyxDQUFDLEVBQUU7QUFDakYsTUFBTSxPQUFPLEVBQUUsQ0FBQztBQUNoQixLQUFLO0FBQ0wsSUFBSSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3JDLEdBQUc7QUFDSDtBQUNBLEVBQUUsTUFBTSxFQUFFLFNBQVMsTUFBTSxDQUFDLFVBQVUsRUFBRTtBQUN0QyxJQUFJLElBQUksVUFBVSxLQUFLLElBQUksSUFBSSxPQUFPLFVBQVUsS0FBSyxRQUFRLEVBQUU7QUFDL0QsTUFBTSxNQUFNLElBQUksU0FBUyxDQUFDLGtFQUFrRSxHQUFHLE9BQU8sVUFBVSxDQUFDLENBQUM7QUFDbEgsS0FBSztBQUNMLElBQUksT0FBTyxPQUFPLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ3BDLEdBQUc7QUFDSDtBQUNBLEVBQUUsS0FBSyxFQUFFLFNBQVMsS0FBSyxDQUFDLElBQUksRUFBRTtBQUM5QixJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNyQjtBQUNBLElBQUksSUFBSSxHQUFHLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsQ0FBQztBQUNqRSxJQUFJLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsT0FBTyxHQUFHLENBQUM7QUFDdEMsSUFBSSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2xDLElBQUksSUFBSSxVQUFVLEdBQUcsSUFBSSxLQUFLLEVBQUUsT0FBTztBQUN2QyxJQUFJLElBQUksS0FBSyxDQUFDO0FBQ2QsSUFBSSxJQUFJLFVBQVUsRUFBRTtBQUNwQixNQUFNLEdBQUcsQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDO0FBQ3JCLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQztBQUNoQixLQUFLLE1BQU07QUFDWCxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUM7QUFDaEIsS0FBSztBQUNMLElBQUksSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDdEIsSUFBSSxJQUFJLFNBQVMsR0FBRyxDQUFDLENBQUM7QUFDdEIsSUFBSSxJQUFJLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNqQixJQUFJLElBQUksWUFBWSxHQUFHLElBQUksQ0FBQztBQUM1QixJQUFJLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0FBQzVCO0FBQ0E7QUFDQTtBQUNBLElBQUksSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDO0FBQ3hCO0FBQ0E7QUFDQSxJQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssRUFBRSxFQUFFLENBQUMsRUFBRTtBQUM1QixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hDLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRSxRQUFRO0FBQzdCO0FBQ0E7QUFDQSxVQUFVLElBQUksQ0FBQyxZQUFZLEVBQUU7QUFDN0IsWUFBWSxTQUFTLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM5QixZQUFZLE1BQU07QUFDbEIsV0FBVztBQUNYLFVBQVUsU0FBUztBQUNuQixTQUFTO0FBQ1QsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsRUFBRTtBQUN0QjtBQUNBO0FBQ0EsUUFBUSxZQUFZLEdBQUcsS0FBSyxDQUFDO0FBQzdCLFFBQVEsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDcEIsT0FBTztBQUNQLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRSxRQUFRO0FBQzdCO0FBQ0EsVUFBVSxJQUFJLFFBQVEsS0FBSyxDQUFDLENBQUMsRUFBRSxRQUFRLEdBQUcsQ0FBQyxDQUFDLEtBQUssSUFBSSxXQUFXLEtBQUssQ0FBQyxFQUFFLFdBQVcsR0FBRyxDQUFDLENBQUM7QUFDeEYsU0FBUyxNQUFNLElBQUksUUFBUSxLQUFLLENBQUMsQ0FBQyxFQUFFO0FBQ3BDO0FBQ0E7QUFDQSxRQUFRLFdBQVcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN6QixPQUFPO0FBQ1AsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLFFBQVEsS0FBSyxDQUFDLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDO0FBQ3JDO0FBQ0EsSUFBSSxXQUFXLEtBQUssQ0FBQztBQUNyQjtBQUNBLElBQUksV0FBVyxLQUFLLENBQUMsSUFBSSxRQUFRLEtBQUssR0FBRyxHQUFHLENBQUMsSUFBSSxRQUFRLEtBQUssU0FBUyxHQUFHLENBQUMsRUFBRTtBQUM3RSxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFO0FBQ3RCLFFBQVEsSUFBSSxTQUFTLEtBQUssQ0FBQyxJQUFJLFVBQVUsRUFBRSxHQUFHLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDMUksT0FBTztBQUNQLEtBQUssTUFBTTtBQUNYLE1BQU0sSUFBSSxTQUFTLEtBQUssQ0FBQyxJQUFJLFVBQVUsRUFBRTtBQUN6QyxRQUFRLEdBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDM0MsUUFBUSxHQUFHLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3RDLE9BQU8sTUFBTTtBQUNiLFFBQVEsR0FBRyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNuRCxRQUFRLEdBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDOUMsT0FBTztBQUNQLE1BQU0sR0FBRyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUMxQyxLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksU0FBUyxH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QyxPQUFPLE9BQU8sS0FBSyxHQUFHLENBQUM7QUFDeEIsQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNLG1CQUFtQixHQUFHO0FBQ25DLENBQUMsR0FBRyxFQUFFLENBQUMsTUFBTSxFQUFFLE1BQU0sS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO0FBQzdJLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDUCxDQUFDOztBQ3JDTSxNQUFNLFVBQVUsR0FBRztBQUMxQixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLE1BQU07QUFDUCxDQUFDLEtBQUs7QUFDTixDQUFDLE1BQU07QUFDUCxDQUFDLE1BQU07QUFDUCxDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLE1BQU07QUFDUCxDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLE1BQU07QUFDUCxDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLElBQUk7QUFDTCxDQUFDLEtBQUs7QUFDTixDQUFDLElBQUk7QUFDTCxDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLE1BQU07QUFDUCxDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLE1BQU07QUFDUCxDQUFDLE1BQU07QUFDUCxDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLE1BQU07QUFDUCxDQUFDLEtBQUs7QUFDTixDQUFDLE9BQU87QUFDUixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLE1BQU07QUFDUCxDQUFDLE1BQU07QUFDUCxDQUFDLE9BQU87QUFDUixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLElBQUk7QUFDTCxDQUFDLElBQUk7QUFDTCxDQUFDLFFBQVE7QUFDVCxDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLElBQUk7QUFDTCxDQUFDLEtBQUs7QUFDTixDQUFDLEdBQUc7QUFDSixDQUFDLElBQUk7QUFDTCxDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLE9BQU87QUFDUixDQUFDLEtBQUs7QUFDTixDQUFDLE1BQU07QUFDUCxDQUFDLE1BQU07QUFDUCxDQUFDLE1BQU07QUFDUCxDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLE1BQU07QUFDUCxDQUFDLE1BQU07QUFDUCxDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLElBQUk7QUFDTCxDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLE1BQU07QUFDUCxDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLE9BQU87QUFDUixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLE9BQU87QUFDUixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLElBQUk7QUFDTCxDQUFDLEtBQUs7QUFDTixDQUFDLElBQUk7QUFDTCxDQUFDLElBQUk7QUFDTCxDQUFDLEtBQUs7QUFDTixDQUFDLE1BQU07QUFDUCxDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLE1BQU07QUFDUCxDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLFNBQVM7QUFDVixDQUFDLE9BQU87QUFDUixDQUFDLEtBQUs7QUFDTixDQUFDLE1BQU07QUFDUCxDQUFDLEtBQUs7QUFDTixDQUFDLE1BQU07QUFDUCxDQUFDLEtBQUs7QUFDTixDQUFDLEtBQUs7QUFDTixDQUFDLENBQUM7QUFDRjtBQUNPLE1BQU0sU0FBUyxHQUFHO0FBQ3pCLENBQUMsWUFBWTtBQUNiLENBQUMsV0FBVztBQUNaLENBQUMsV0FBVztBQUNaLENBQUMsWUFBWTtBQUNiLENBQUMsWUFBWTtBQUNiLENBQUMsYUFBYTtBQUNkLENBQUMsbUJBQW1CO0FBQ3BCLENBQUMsbUJBQW1CO0FBQ3BCLENBQUMsWUFBWTtBQUNiLENBQUMsV0FBVztBQUNaLENBQUMsb0JBQW9CO0FBQ3JCLENBQUMsMkJBQTJCO0FBQzVCLENBQUMsd0JBQXdCO0FBQ3pCLENBQUMsc0JBQXNCO0FBQ3ZCLENBQUMseUJBQXlCO0FBQzFCLENBQUMseUNBQXlDO0FBQzFDLENBQUMsZ0RBQWdEO0FBQ2pELENBQUMsaURBQWlEO0FBQ2xELENBQUMseUVBQXlFO0FBQzFFLENBQUMsMkVBQTJFO0FBQzVFLENBQUMsbUVBQW1FO0FBQ3BFLENBQUMsaUJBQWlCO0FBQ2xCLENBQUMsbUJBQW1CO0FBQ3BCLENBQUMsOEJBQThCO0FBQy9CLENBQUMsa0JBQWtCO0FBQ25CLENBQUMscUJBQXFCO0FBQ3RCLENBQUMsNkJBQTZCO0FBQzlCLENBQUMsK0JBQStCO0FBQ2hDLENBQUMsNEJBQTRCO0FBQzdCLENBQUMsV0FBVztBQUNaLENBQUMsWUFBWTtBQUNiLENBQUMsa0JBQWtCO0FBQ25CLENBQUMsWUFBWTtBQUNiLENBQUMsaUJBQWlCO0FBQ2xCLENBQUMsZUFBZTtBQUNoQixDQUFDLGdCQUFnQjtBQUNqQixDQUFDLGFBQWE7QUFDZCxDQUFDLGdCQUFnQjtBQUNqQixDQUFDLGdCQUFnQjtBQUNqQixDQUFDLHdCQUF3QjtBQUN6QixDQUFDLFlBQVk7QUFDYixDQUFDLFlBQVk7QUFDYixDQUFDLFlBQVk7QUFDYixDQUFDLFdBQVc7QUFDWixDQUFDLFlBQVk7QUFDYixDQUFDLFdBQVc7QUFDWixDQUFDLFdBQVc7QUFDWixDQUFDLGlCQUFpQjtBQUNsQixDQUFDLGNBQWM7QUFDZixDQUFDLFdBQVc7QUFDWixDQUFDLGVBQWU7QUFDaEIsQ0FBQyxXQUFXO0FBQ1osQ0FBQyxpQkFBaUI7QUFDbEIsQ0FBQyxtQkFBbUI7QUFDcEIsQ0FBQywyQkFBMkI7QUFDNUIsQ0FBQywwQkFBMEI7QUFDM0IsQ0FBQywrQkFBK0I7QUFDaEMsQ0FBQyxpQkFBaUI7QUFDbEIsQ0FBQyxrQkFBa0I7QUFDbkIsQ0FBQyxXQUFXO0FBQ1osQ0FBQyxZQUFZO0FBQ2IsQ0FBQywrQkFBK0I7QUFDaEMsQ0FBQyxVQUFVO0FBQ1gsQ0FBQyxVQUFVO0FBQ1gsQ0FBQyxjQUFjO0FBQ2YsQ0FBQyxhQUFhO0FBQ2QsQ0FBQyx3QkFBd0I7QUFDekIsQ0FBQyxpQkFBaUI7QUFDbEIsQ0FBQyxrQkFBa0I7QUFDbkIsQ0FBQyx1QkFBdUI7QUFDeEIsQ0FBQyxnQ0FBZ0M7QUFDakMsQ0FBQyx1Q0FBdUM7QUFDeEMsQ0FBQyxtQ0FBbUM7QUFDcEMsQ0FBQyxtQkFBbUI7QUFDcEIsQ0FBQyw0QkFBNEI7QUFDN0IsQ0FBQyxtQkFBbUI7QUFDcEIsQ0FBQyx3QkFBd0I7QUFDekIsQ0FBQyxvQkFBb0I7QUFDckIsQ0FBQyxtQkFBbUI7QUFDcEIsQ0FBQyxtQkFBbUI7QUFDcEIsQ0FBQyxpQkFBaUI7QUFDbEIsQ0FBQyxZQUFZO0FBQ2IsQ0FBQyx1QkFBdUI7QUFDeEIsQ0FBQyxXQUFXO0FBQ1osQ0FBQyxXQUFXO0FBQ1osQ0FBQyxXQUFXO0FBQ1osQ0FBQyxXQUFXO0FBQ1osQ0FBQyxXQUFXO0FBQ1osQ0FBQyxXQUFXO0FBQ1osQ0FBQyxZQUFZO0FBQ2IsQ0FBQyxpQkFBaUI7QUFDbEIsQ0FBQyxnQ0FBZ0M7QUFDakMsQ0FBQyxZQUFZO0FBQ2IsQ0FBQyxxQkFBcUI7QUFDdEIsQ0FBQyxZQUFZO0FBQ2IsQ0FBQyxxQkFBcUI7QUFDdEIsQ0FBQyxZQUFZO0FBQ2IsQ0FBQyxXQUFXO0FBQ1osQ0FBQyxtQkFBbUI7QUFDcEIsQ0FBQyxrQkFBa0I7QUFDbkIsQ0FBQyxlQUFlO0FBQ2hCLENBQUMsWUFBWTtBQUNiLENBQUMsbUJBQW1CO0FBQ3BCLENBQUMsOEJBQThCO0FBQy9CLENBQUMsYUFBYTtBQUNkLENBQUMsMkJBQTJCO0FBQzVCLENBQUMsMkJBQTJCO0FBQzVCLENBQUMsYUFBYTtBQUNkLENBQUMsd0JBQXdCO0FBQ3pCLENBQUMsYUFBYTtBQUNkLENBQUMsWUFBWTtBQUNiLENBQUMscUJBQXFCO0FBQ3RCLENBQUMsa0JBQWtCO0FBQ25CLENBQUMsbUJBQW1CO0FBQ3BCLENBQUMsbUJBQW1CO0FBQ3BCLENBQUMsdUJBQXVCO0FBQ3hCLENBQUMsc0JBQXNCO0FBQ3ZCLENBQUMsYUFBYTtBQUNkLENBQUMsYUFBYTtBQUNkLENBQUMsMEJBQTBCO0FBQzNCLENBQUMsV0FBVztBQUNaLENBQUMsWUFBWTtBQUNiLENBQUMsYUFBYTtBQUNkLENBQUMsWUFBWTtBQUNiLENBQUMsWUFBWTtBQUNiLENBQUMsWUFBWTtBQUNiLENBQUMsOEJBQThCO0FBQy9CLENBQUMsWUFBWTtBQUNiLENBQUMsOEJBQThCO0FBQy9CLENBQUMsMkJBQTJCO0FBQzVCLENBQUMsb0JBQW9CO0FBQ3JCLENBQUMsV0FBVztBQUNaLENBQUMsNkJBQTZCO0FBQzlCLENBQUMsV0FBVztBQUNaLENBQUMsV0FBVztBQUNaLENBQUMsa0JBQWtCO0FBQ25CLENBQUMsV0FBVztBQUNaLENBQUMsNEJBQTRCO0FBQzdCLENBQUMsZUFBZTtBQUNoQixDQUFDLHVCQUF1QjtBQUN4QixDQUFDLHFCQUFxQjtBQUN0QixDQUFDLG1CQUFtQjtBQUNwQixDQUFDLG9CQUFvQjtBQUNyQixDQUFDLDhCQUE4QjtBQUMvQixDQUFDLGtCQUFrQjtBQUNuQixDQUFDLDRCQUE0QjtBQUM3QixDQUFDLDRCQUE0QjtBQUM3QixDQUFDOztBQ3JTRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUM7QUFLMUI7QUFDTyxlQUFlLGtCQUFrQixDQUFDLEtBQUssRUFBRTtBQUNoRCxDQUFDLE9BQU8sSUFBSSxjQUFjLEVBQUUsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDL0MsQ0FBQztBQUtEO0FBQ0EsU0FBUyxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUU7QUFDMUMsQ0FBQyxPQUFPLEdBQUc7QUFDWCxFQUFFLE1BQU0sRUFBRSxDQUFDO0FBQ1gsRUFBRSxHQUFHLE9BQU87QUFDWixFQUFFLENBQUM7QUFDSDtBQUNBLENBQUMsS0FBSyxNQUFNLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxJQUFJLE9BQU8sQ0FBQyxPQUFPLEVBQUUsRUFBRTtBQUNsRDtBQUNBLEVBQUUsSUFBSSxPQUFPLENBQUMsSUFBSSxFQUFFO0FBQ3BCO0FBQ0EsR0FBRyxJQUFJLE1BQU0sTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLE1BQU0sQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUU7QUFDMUUsSUFBSSxPQUFPLEtBQUssQ0FBQztBQUNqQixJQUFJO0FBQ0osR0FBRyxNQUFNLElBQUksTUFBTSxLQUFLLE1BQU0sQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0FBQ3hELEdBQUcsT0FBTyxLQUFLLENBQUM7QUFDaEIsR0FBRztBQUNILEVBQUU7QUFDRjtBQUNBLENBQUMsT0FBTyxJQUFJLENBQUM7QUFDYixDQUFDO0FBS0Q7QUFDTyxNQUFNLGNBQWMsQ0FBQztBQUM1QixDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUU7QUFDdEIsRUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLE9BQU8sRUFBRSxlQUFlLENBQUM7QUFDNUM7QUFDQSxFQUFFLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckQsRUFBRSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQy9DLEVBQUUsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNyQyxFQUFFO0FBQ0Y7QUFDQSxDQUFDLE1BQU0sYUFBYSxDQUFDLFNBQVMsRUFBRTtBQUNoQyxFQUFFLE1BQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUM7QUFDN0M7QUFDQSxFQUFFLEtBQUssTUFBTSxRQUFRLElBQUksSUFBSSxDQUFDLFNBQVMsSUFBSSxFQUFFLEVBQUU7QUFDL0MsR0FBRyxNQUFNLFFBQVEsR0FBRyxNQUFNLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUM5QyxHQUFHLElBQUksUUFBUSxFQUFFO0FBQ2pCLElBQUksT0FBTyxRQUFRLENBQUM7QUFDcEIsSUFBSTtBQUNKO0FBQ0EsR0FBRyxJQUFJLGVBQWUsS0FBSyxTQUFTLENBQUMsUUFBUSxFQUFFO0FBQy9DLElBQUksT0FBTyxTQUFTLENBQUM7QUFDckIsSUFBSTtBQUNKLEdBQUc7QUFDSDtBQUNBLEVBQUUsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQy9CLEVBQUU7QUFDRjtBQUNBLENBQUMsTUFBTSxVQUFVLENBQUMsS0FBSyxFQUFFO0FBQ3pCLEVBQUUsSUFBSSxFQUFFLEtBQUssWUFBWSxVQUFVLElBQUksS0FBSyxZQUFZLFdBQVcsQ0FBQyxFQUFFO0FBQ3RFLEdBQUcsTUFBTSxJQUFJLFNBQVMsQ0FBQyxDQUFDLHFHQUFxRyxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDakosR0FBRztBQUNIO0FBQ0EsRUFBRSxNQUFNLE1BQU0sR0FBRyxLQUFLLFlBQVksVUFBVSxHQUFHLEtBQUssR0FBRyxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUM3RTtBQUNBLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLEdBQUcsQ0FBQyxDQUFDLEVBQUU7QUFDN0IsR0FBRyxPQUFPO0FBQ1YsR0FBRztBQUNIO0FBQ0EsRUFBRSxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUNDLFVBQWtCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUN4RCxFQUFFO0FBQ0Y7QUFDQSxDQUFDLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRTtBQUN0QixFQUFFLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO0FBQzFDLEVBQUUsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDakQsRUFBRTtBQUNGO0FBQ0EsQ0FBQyxNQUFNLFVBQVUsQ0FBQyxNQUFNLEVBQUU7QUFDMUIsRUFBRSxNQUFNLFNBQVMsR0FBRyxNQUFNQyxVQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3JELEVBQUUsSUFBSTtBQUNOLEdBQUcsT0FBTyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDOUMsR0FBRyxTQUFTO0FBQ1osR0FBRyxNQUFNLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztBQUMzQixHQUFHO0FBQ0gsRUFBRTtBQUNGO0FBQ0EsQ0FBQyxNQUFNLGlCQUFpQixDQUFDLGNBQWMsRUFBRSxPQUFPLEdBQUcsRUFBRSxFQUFFO0FBQ3ZELEVBQUUsTUFBTSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsR0FBRyxNQUFNLE9BQU8sYUFBYSxDQUFDLENBQUM7QUFDeEQsRUFBRSxNQUFNLENBQUMsVUFBVSxHQUFHLFlBQVksQ0FBQyxHQUFHLE9BQU8sQ0FBQztBQUM5QztBQUNBLEVBQUUsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEtBQUs7QUFDMUMsR0FBRyxjQUFjLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztBQUN0QztBQUNBLEdBQUcsY0FBYyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsTUFBTTtBQUN6QyxJQUFJLENBQUMsWUFBWTtBQUNqQixLQUFLLElBQUk7QUFDVDtBQUNBLE1BQU0sTUFBTSxJQUFJLEdBQUcsSUFBSSxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUM7QUFDNUMsTUFBTSxNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQyxHQUFHLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDekg7QUFDQTtBQUNBLE1BQU0sTUFBTSxLQUFLLEdBQUcsY0FBYyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxjQUFjLENBQUMsSUFBSSxFQUFFLElBQUlGLGtCQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hHLE1BQU0sSUFBSTtBQUNWLE9BQU8sSUFBSSxDQUFDLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDcEQsT0FBTyxDQUFDLE9BQU8sS0FBSyxFQUFFO0FBQ3RCLE9BQU8sSUFBSSxLQUFLLFlBQVlHLGdCQUF3QixFQUFFO0FBQ3RELFFBQVEsSUFBSSxDQUFDLFFBQVEsR0FBRyxTQUFTLENBQUM7QUFDbEMsUUFBUSxNQUFNO0FBQ2QsUUFBUSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDdEIsUUFBUTtBQUNSLE9BQU87QUFDUDtBQUNBLE1BQU0sT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQzVCLE1BQU0sQ0FBQyxPQUFPLEtBQUssRUFBRTtBQUNyQixNQUFNLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNwQixNQUFNO0FBQ04sS0FBSyxHQUFHLENBQUM7QUFDVCxJQUFJLENBQUMsQ0FBQztBQUNOLEdBQUcsQ0FBQyxDQUFDO0FBQ0wsRUFBRTtBQUNGO0FBQ0EsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRTtBQUN4QixFQUFFLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQzlDLEVBQUU7QUFDRjtBQUNBLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUU7QUFDOUIsRUFBRSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ3BELEVBQUU7QUFDRjtBQUNBLENBQUMsTUFBTSxLQUFLLENBQUMsU0FBUyxFQUFFO0FBQ3hCLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBR0gsa0JBQU0sQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDM0M7QUFDQTtBQUNBLEVBQUUsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUU7QUFDN0MsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7QUFDckQsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztBQUM3QjtBQUNBLEVBQUUsTUFBTSxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3pFO0FBQ0E7QUFDQTtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDaEMsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLFdBQVc7QUFDckIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUNoQyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsd0JBQXdCO0FBQ2xDLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDaEMsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLCtCQUErQjtBQUN6QyxJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQ2hDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSwwQkFBMEI7QUFDcEMsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUNoQyxHQUFHLE1BQU0sU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUMxRTtBQUNBLEdBQUc7QUFDSCxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzlDLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDL0MsS0FBSztBQUNMLElBQUksT0FBTztBQUNYLEtBQUssR0FBRyxFQUFFLEtBQUs7QUFDZixLQUFLLElBQUksRUFBRSxpQkFBaUI7QUFDNUIsS0FBSyxDQUFDO0FBQ04sSUFBSTtBQUNKO0FBQ0EsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsSUFBSTtBQUNiLElBQUksSUFBSSxFQUFFLHdCQUF3QjtBQUNsQyxJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFO0FBQ0YsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzNCLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUM5QixJQUFJO0FBQ0osR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksSUFBSSxFQUFFLHdCQUF3QjtBQUNsQyxJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQ2hDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLE1BQU07QUFDZixJQUFJLElBQUksRUFBRSxvQkFBb0I7QUFDOUIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUNoQyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsbUJBQW1CO0FBQzdCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUN0QztBQUNBLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDNUIsR0FBRyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDaEMsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDdEMsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLFdBQVc7QUFDckIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDdEMsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLG9CQUFvQjtBQUM5QixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRTtBQUNyQyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxJQUFJO0FBQ2IsSUFBSSxJQUFJLEVBQUUsa0JBQWtCO0FBQzVCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQ3RDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxxQkFBcUI7QUFDL0IsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEVBQUU7QUFDL0IsR0FBRyxNQUFNLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDN0IsR0FBRyxNQUFNLGVBQWUsR0FBRyxNQUFNLFNBQVMsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLENBQUMsQ0FBQztBQUMxRSxHQUFHLElBQUksU0FBUyxDQUFDLFFBQVEsR0FBRyxlQUFlLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUU7QUFDdkU7QUFDQSxJQUFJLE9BQU87QUFDWCxLQUFLLEdBQUcsRUFBRSxLQUFLO0FBQ2YsS0FBSyxJQUFJLEVBQUUsWUFBWTtBQUN2QixLQUFLLENBQUM7QUFDTixJQUFJO0FBQ0o7QUFDQSxHQUFHLE1BQU0sU0FBUyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUMzQyxHQUFHLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUN4QyxHQUFHO0FBQ0g7QUFDQTtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQy9CLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxrQkFBa0I7QUFDNUIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRTtBQUNGLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUk7QUFDdEQsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzNDLElBQUk7QUFDSixHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsK0JBQStCO0FBQ3pDLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQ3RDLEdBQUcsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUN4QyxJQUFJLE9BQU87QUFDWCxLQUFLLEdBQUcsRUFBRSxLQUFLO0FBQ2YsS0FBSyxJQUFJLEVBQUUsV0FBVztBQUN0QixLQUFLLENBQUM7QUFDTixJQUFJO0FBQ0o7QUFDQSxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsWUFBWTtBQUN0QixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDNUMsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsTUFBTTtBQUNmLElBQUksSUFBSSxFQUFFLGtCQUFrQjtBQUM1QixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRTtBQUNoQyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxNQUFNO0FBQ2YsSUFBSSxJQUFJLEVBQUUsWUFBWTtBQUN0QixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRTtBQUNoQyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsMkJBQTJCO0FBQ3JDLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQzdDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLE1BQU07QUFDZixJQUFJLElBQUksRUFBRSxZQUFZO0FBQ3RCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEVBQUU7QUFDaEMsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLGtCQUFrQjtBQUM1QixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRTtBQUNoQyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsWUFBWTtBQUN0QixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUM3QyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxNQUFNO0FBQ2YsSUFBSSxJQUFJLEVBQUUsWUFBWTtBQUN0QixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFO0FBQzFDLEdBQUcsSUFBSTtBQUNQLElBQUksT0FBTyxTQUFTLENBQUMsUUFBUSxHQUFHLEVBQUUsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRTtBQUM5RCxLQUFLLE1BQU0sU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDM0Q7QUFDQTtBQUNBLEtBQUssTUFBTSxTQUFTLEdBQUc7QUFDdkIsTUFBTSxjQUFjLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO0FBQ2xELE1BQU0sZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO0FBQ3BELE1BQU0sY0FBYyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztBQUNsRCxNQUFNLGdCQUFnQixFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztBQUNwRCxNQUFNLENBQUM7QUFDUDtBQUNBLEtBQUssU0FBUyxDQUFDLFFBQVEsR0FBRyxNQUFNLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSUksVUFBZ0IsQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDN0csS0FBSyxNQUFNLFNBQVMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLENBQUM7QUFDeEQ7QUFDQTtBQUNBLEtBQUssSUFBSSxTQUFTLENBQUMsUUFBUSxLQUFLLHNCQUFzQixFQUFFO0FBQ3hELE1BQU0sT0FBTztBQUNiLE9BQU8sR0FBRyxFQUFFLEtBQUs7QUFDakIsT0FBTyxJQUFJLEVBQUUseUJBQXlCO0FBQ3RDLE9BQU8sQ0FBQztBQUNSLE1BQU07QUFDTjtBQUNBLEtBQUssSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRTtBQUN0RixNQUFNLE1BQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BELE1BQU0sUUFBUSxJQUFJO0FBQ2xCLE9BQU8sS0FBSyxPQUFPO0FBQ25CLFFBQVEsTUFBTTtBQUNkLE9BQU8sS0FBSyxNQUFNO0FBQ2xCLFFBQVEsT0FBTztBQUNmLFNBQVMsR0FBRyxFQUFFLE1BQU07QUFDcEIsU0FBUyxJQUFJLEVBQUUseUVBQXlFO0FBQ3hGLFNBQVMsQ0FBQztBQUNWLE9BQU8sS0FBSyxLQUFLO0FBQ2pCLFFBQVEsT0FBTztBQUNmLFNBQVMsR0FBRyxFQUFFLE1BQU07QUFDcEIsU0FBUyxJQUFJLEVBQUUsMkVBQTJFO0FBQzFGLFNBQVMsQ0FBQztBQUNWLE9BQU8sS0FBSyxJQUFJO0FBQ2hCLFFBQVEsT0FBTztBQUNmLFNBQVMsR0FBRyxFQUFFLE1BQU07QUFDcEIsU0FBUyxJQUFJLEVBQUUsbUVBQW1FO0FBQ2xGLFNBQVMsQ0FBQztBQUNWLE9BQU87QUFDUCxRQUFRLE1BQU07QUFDZCxPQUFPO0FBQ1AsTUFBTTtBQUNOO0FBQ0EsS0FBSyxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQy9DLE1BQU0sT0FBTztBQUNiLE9BQU8sR0FBRyxFQUFFLE1BQU07QUFDbEIsT0FBTyxJQUFJLEVBQUUsbUVBQW1FO0FBQ2hGLE9BQU8sQ0FBQztBQUNSLE1BQU07QUFDTjtBQUNBLEtBQUssSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRTtBQUN4RixNQUFNLE9BQU87QUFDYixPQUFPLEdBQUcsRUFBRSxLQUFLO0FBQ2pCLE9BQU8sSUFBSSxFQUFFLFdBQVc7QUFDeEIsT0FBTyxDQUFDO0FBQ1IsTUFBTTtBQUNOO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSyxJQUFJLFNBQVMsQ0FBQyxRQUFRLEtBQUssVUFBVSxJQUFJLFNBQVMsQ0FBQyxjQUFjLEtBQUssU0FBUyxDQUFDLGdCQUFnQixFQUFFO0FBQ3ZHLE1BQU0sSUFBSSxRQUFRLEdBQUcsTUFBTSxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUlBLFVBQWdCLENBQUMsU0FBUyxDQUFDLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQ3hHLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUNqQztBQUNBLE1BQU0sUUFBUSxRQUFRO0FBQ3RCLE9BQU8sS0FBSyxzQkFBc0I7QUFDbEMsUUFBUSxPQUFPO0FBQ2YsU0FBUyxHQUFHLEVBQUUsTUFBTTtBQUNwQixTQUFTLElBQUksRUFBRSxzQkFBc0I7QUFDckMsU0FBUyxDQUFDO0FBQ1YsT0FBTyxLQUFLLHlDQUF5QztBQUNyRCxRQUFRLE9BQU87QUFDZixTQUFTLEdBQUcsRUFBRSxLQUFLO0FBQ25CLFNBQVMsSUFBSSxFQUFFLHlDQUF5QztBQUN4RCxTQUFTLENBQUM7QUFDVixPQUFPLEtBQUssZ0RBQWdEO0FBQzVELFFBQVEsT0FBTztBQUNmLFNBQVMsR0FBRyxFQUFFLEtBQUs7QUFDbkIsU0FBUyxJQUFJLEVBQUUsZ0RBQWdEO0FBQy9ELFNBQVMsQ0FBQztBQUNWLE9BQU8sS0FBSyxpREFBaUQ7QUFDN0QsUUFBUSxPQUFPO0FBQ2YsU0FBUyxHQUFHLEVBQUUsS0FBSztBQUNuQixTQUFTLElBQUksRUFBRSxpREFBaUQ7QUFDaEUsU0FBUyxDQUFDO0FBQ1YsT0FBTyxRQUFRO0FBQ2YsT0FBTztBQUNQLE1BQU07QUFDTjtBQUNBO0FBQ0EsS0FBSyxJQUFJLFNBQVMsQ0FBQyxjQUFjLEtBQUssQ0FBQyxFQUFFO0FBQ3pDLE1BQU0sSUFBSSxlQUFlLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDL0I7QUFDQSxNQUFNLE9BQU8sZUFBZSxHQUFHLENBQUMsS0FBSyxTQUFTLENBQUMsUUFBUSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDcEYsT0FBTyxNQUFNLFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ2xFO0FBQ0EsT0FBTyxlQUFlLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNuRTtBQUNBLE9BQU8sTUFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLGVBQWUsSUFBSSxDQUFDLEdBQUcsZUFBZSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDM0YsT0FBTztBQUNQLE1BQU0sTUFBTTtBQUNaLE1BQU0sTUFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUN2RCxNQUFNO0FBQ04sS0FBSztBQUNMLElBQUksQ0FBQyxPQUFPLEtBQUssRUFBRTtBQUNuQixJQUFJLElBQUksRUFBRSxLQUFLLFlBQVlELGdCQUF3QixDQUFDLEVBQUU7QUFDdEQsS0FBSyxNQUFNLEtBQUssQ0FBQztBQUNqQixLQUFLO0FBQ0wsSUFBSTtBQUNKO0FBQ0EsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLGlCQUFpQjtBQUMzQixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRTtBQUNoQztBQUNBLEdBQUcsTUFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzlCLEdBQUcsTUFBTSxJQUFJLEdBQUdILGtCQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hDLEdBQUcsTUFBTSxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3BDO0FBQ0E7QUFDQSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQ3ZFLElBQUksT0FBTztBQUNYLEtBQUssR0FBRyxFQUFFLE1BQU07QUFDaEIsS0FBSyxJQUFJLEVBQUUsWUFBWTtBQUN2QixLQUFLLENBQUM7QUFDTixJQUFJO0FBQ0o7QUFDQTtBQUNBLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUNqRSxJQUFJLE9BQU87QUFDWCxLQUFLLEdBQUcsRUFBRSxLQUFLO0FBQ2YsS0FBSyxJQUFJLEVBQUUsV0FBVztBQUN0QixLQUFLLENBQUM7QUFDTixJQUFJO0FBQ0o7QUFDQTtBQUNBLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUNqRSxJQUFJLE9BQU87QUFDWCxLQUFLLEdBQUcsRUFBRSxLQUFLO0FBQ2YsS0FBSyxJQUFJLEVBQUUsV0FBVztBQUN0QixLQUFLLENBQUM7QUFDTixJQUFJO0FBQ0o7QUFDQTtBQUNBLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDckQsSUFBSSxPQUFPO0FBQ1gsS0FBSyxHQUFHLEVBQUUsS0FBSztBQUNmLEtBQUssSUFBSSxFQUFFLFdBQVc7QUFDdEIsS0FBSyxDQUFDO0FBQ04sSUFBSTtBQUNKO0FBQ0E7QUFDQSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDakUsSUFBSSxPQUFPO0FBQ1gsS0FBSyxHQUFHLEVBQUUsS0FBSztBQUNmLEtBQUssSUFBSSxFQUFFLFdBQVc7QUFDdEIsS0FBSyxDQUFDO0FBQ04sSUFBSTtBQUNKO0FBQ0E7QUFDQSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDakUsSUFBSSxPQUFPO0FBQ1gsS0FBSyxHQUFHLEVBQUUsS0FBSztBQUNmLEtBQUssSUFBSSxFQUFFLFdBQVc7QUFDdEIsS0FBSyxDQUFDO0FBQ04sSUFBSTtBQUNKO0FBQ0E7QUFDQSxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsaUJBQWlCO0FBQzNCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUU7QUFDRixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDM0IsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQztBQUNsRixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDO0FBQ2xGLElBQUk7QUFDSixHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsaUJBQWlCO0FBQzNCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUU7QUFDRixHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3hDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksTUFBTSxJQUFJO0FBQ3RDLElBQUk7QUFDSjtBQUNBO0FBQ0EsR0FBRyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDdEYsR0FBRyxRQUFRLFVBQVU7QUFDckIsSUFBSSxLQUFLLE1BQU0sQ0FBQztBQUNoQixJQUFJLEtBQUssTUFBTTtBQUNmLEtBQUssT0FBTyxDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDO0FBQzlDLElBQUksS0FBSyxNQUFNO0FBQ2YsS0FBSyxPQUFPLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDOUMsSUFBSSxLQUFLLE1BQU07QUFDZixLQUFLLE9BQU8sQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO0FBQ3ZELElBQUksS0FBSyxNQUFNLENBQUM7QUFDaEIsSUFBSSxLQUFLLE1BQU07QUFDZixLQUFLLE9BQU8sQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQztBQUM5QyxJQUFJLEtBQUssTUFBTSxDQUFDO0FBQ2hCLElBQUksS0FBSyxNQUFNO0FBQ2YsS0FBSyxPQUFPLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUscUJBQXFCLENBQUMsQ0FBQztBQUN2RCxJQUFJLEtBQUssSUFBSTtBQUNiLEtBQUssT0FBTyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLGlCQUFpQixDQUFDLENBQUM7QUFDbEQsSUFBSSxLQUFLLEtBQUssQ0FBQztBQUNmLElBQUksS0FBSyxNQUFNLENBQUM7QUFDaEIsSUFBSSxLQUFLLE1BQU07QUFDZixLQUFLLE9BQU8sQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxhQUFhLENBQUMsQ0FBQztBQUM5QyxJQUFJLEtBQUssS0FBSztBQUNkLEtBQUssT0FBTyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBQzVDLElBQUksS0FBSyxLQUFLO0FBQ2QsS0FBSyxPQUFPLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDNUMsSUFBSSxLQUFLLEtBQUs7QUFDZCxLQUFLLE9BQU8sQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxhQUFhLENBQUMsQ0FBQztBQUM5QyxJQUFJLEtBQUssS0FBSztBQUNkLEtBQUssT0FBTyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBQzVDLElBQUksS0FBSyxLQUFLO0FBQ2QsS0FBSyxPQUFPLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDNUMsSUFBSSxLQUFLLEtBQUs7QUFDZCxLQUFLLE9BQU8sQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztBQUM1QyxJQUFJLEtBQUssS0FBSztBQUNkLEtBQUssT0FBTyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBQzVDLElBQUksS0FBSyxLQUFLO0FBQ2QsS0FBSyxPQUFPLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztBQUNwRCxJQUFJO0FBQ0osS0FBSyxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDdEMsTUFBTSxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUU7QUFDeEMsT0FBTyxPQUFPLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsYUFBYSxDQUFDLENBQUM7QUFDaEQsT0FBTztBQUNQO0FBQ0EsTUFBTSxPQUFPLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDOUMsTUFBTTtBQUNOO0FBQ0EsS0FBSyxPQUFPLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDNUMsSUFBSTtBQUNKLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0FBQ2hDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxZQUFZO0FBQ3RCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUU7QUFDRixHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDO0FBQzNCO0FBQ0EsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDckQsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM1QyxJQUFJO0FBQ0osSUFBSTtBQUNKLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLE1BQU07QUFDZixJQUFJLElBQUksRUFBRSxXQUFXO0FBQ3JCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUU7QUFDRixHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDO0FBQzNCO0FBQ0EsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDckQsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM1QyxJQUFJO0FBQ0osSUFBSTtBQUNKLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLE9BQU87QUFDaEIsSUFBSSxJQUFJLEVBQUUsWUFBWTtBQUN0QixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDcEYsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsTUFBTTtBQUNmLElBQUksSUFBSSxFQUFFLDhCQUE4QjtBQUN4QyxJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQTtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0FBQ2hDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxhQUFhO0FBQ3ZCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0FBQ2hDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLElBQUk7QUFDYixJQUFJLElBQUksRUFBRSxvQkFBb0I7QUFDOUIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEVBQUU7QUFDaEMsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsTUFBTTtBQUNmLElBQUksSUFBSSxFQUFFLGNBQWM7QUFDeEIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQzVDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxXQUFXO0FBQ3JCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0FBQ2hDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLElBQUk7QUFDYixJQUFJLElBQUksRUFBRSxlQUFlO0FBQ3pCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0FBQ2hDLEdBQUcsSUFBSTtBQUNQLElBQUksTUFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2pDLElBQUksTUFBTSxhQUFhLEdBQUcsRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUM7QUFDM0MsSUFBSSxNQUFNLE1BQU0sR0FBR0Esa0JBQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ2xGLElBQUksTUFBTSxTQUFTLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQzFEO0FBQ0E7QUFDQSxJQUFJLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQ0Esa0JBQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsRUFBRTtBQUN2RCxLQUFLLE9BQU87QUFDWixNQUFNLEdBQUcsRUFBRSxJQUFJO0FBQ2YsTUFBTSxJQUFJLEVBQUUsd0JBQXdCO0FBQ3BDLE1BQU0sQ0FBQztBQUNQLEtBQUs7QUFDTCxJQUFJLENBQUMsT0FBTyxLQUFLLEVBQUU7QUFDbkI7QUFDQSxJQUFJLElBQUksRUFBRSxLQUFLLFlBQVlHLGdCQUF3QixDQUFDLEVBQUU7QUFDdEQsS0FBSyxNQUFNLEtBQUssQ0FBQztBQUNqQixLQUFLO0FBQ0wsSUFBSTtBQUNKO0FBQ0E7QUFDQSxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsaUJBQWlCO0FBQzNCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUM1QyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxNQUFNO0FBQ2YsSUFBSSxJQUFJLEVBQUUsa0JBQWtCO0FBQzVCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUNoQyxHQUFHLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNyRCxHQUFHLElBQUksUUFBUSxFQUFFO0FBQ2pCLElBQUksT0FBTyxRQUFRLENBQUM7QUFDcEIsSUFBSTtBQUNKLEdBQUc7QUFDSDtBQUNBO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUNoQyxHQUFHLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNwRCxHQUFHLElBQUksUUFBUSxFQUFFO0FBQ2pCLElBQUksT0FBTyxRQUFRLENBQUM7QUFDcEIsSUFBSTtBQUNKLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0FBQ2hDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxXQUFXO0FBQ3JCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQzVDLEdBQUcsZUFBZSxTQUFTLEdBQUc7QUFDOUIsSUFBSSxNQUFNLEdBQUcsR0FBRyxNQUFNLFNBQVMsQ0FBQyxVQUFVLENBQUNFLEtBQVcsQ0FBQyxDQUFDO0FBQ3hELElBQUksSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ3BCLElBQUksSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ2Y7QUFDQTtBQUNBLElBQUksT0FBTyxDQUFDLEdBQUcsR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLEVBQUU7QUFDN0MsS0FBSyxFQUFFLEVBQUUsQ0FBQztBQUNWLEtBQUssSUFBSSxLQUFLLENBQUMsQ0FBQztBQUNoQixLQUFLO0FBQ0w7QUFDQSxJQUFJLE1BQU0sRUFBRSxHQUFHTCxrQkFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDcEMsSUFBSSxNQUFNLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDbkMsSUFBSSxPQUFPLEVBQUUsQ0FBQztBQUNkLElBQUk7QUFDSjtBQUNBLEdBQUcsZUFBZSxXQUFXLEdBQUc7QUFDaEMsSUFBSSxNQUFNLEVBQUUsR0FBRyxNQUFNLFNBQVMsRUFBRSxDQUFDO0FBQ2pDLElBQUksTUFBTSxXQUFXLEdBQUcsTUFBTSxTQUFTLEVBQUUsQ0FBQztBQUMxQyxJQUFJLFdBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLEtBQUssV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN2RCxJQUFJLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNyRCxJQUFJLE9BQU87QUFDWCxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDO0FBQ3BDLEtBQUssR0FBRyxFQUFFLFdBQVcsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxRQUFRLEVBQUUsUUFBUSxDQUFDO0FBQ3pFLEtBQUssQ0FBQztBQUNOLElBQUk7QUFDSjtBQUNBLEdBQUcsZUFBZSxZQUFZLENBQUMsUUFBUSxFQUFFO0FBQ3pDLElBQUksT0FBTyxRQUFRLEdBQUcsQ0FBQyxFQUFFO0FBQ3pCLEtBQUssTUFBTSxPQUFPLEdBQUcsTUFBTSxXQUFXLEVBQUUsQ0FBQztBQUN6QyxLQUFLLElBQUksT0FBTyxDQUFDLEVBQUUsS0FBSyxPQUFPLEVBQUU7QUFDakMsTUFBTSxNQUFNLFFBQVEsR0FBRyxNQUFNLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSUksVUFBZ0IsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDN0YsTUFBTSxPQUFPLFFBQVEsQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQzdDLE1BQU07QUFDTjtBQUNBLEtBQUssTUFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN6QyxLQUFLLEVBQUUsUUFBUSxDQUFDO0FBQ2hCLEtBQUs7QUFDTCxJQUFJO0FBQ0o7QUFDQSxHQUFHLE1BQU0sRUFBRSxHQUFHLE1BQU0sV0FBVyxFQUFFLENBQUM7QUFDbEMsR0FBRyxNQUFNLE9BQU8sR0FBRyxNQUFNLFlBQVksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDOUM7QUFDQSxHQUFHLFFBQVEsT0FBTztBQUNsQixJQUFJLEtBQUssTUFBTTtBQUNmLEtBQUssT0FBTztBQUNaLE1BQU0sR0FBRyxFQUFFLE1BQU07QUFDakIsTUFBTSxJQUFJLEVBQUUsWUFBWTtBQUN4QixNQUFNLENBQUM7QUFDUDtBQUNBLElBQUksS0FBSyxVQUFVO0FBQ25CLEtBQUssT0FBTztBQUNaLE1BQU0sR0FBRyxFQUFFLEtBQUs7QUFDaEIsTUFBTSxJQUFJLEVBQUUsa0JBQWtCO0FBQzlCLE1BQU0sQ0FBQztBQUNQO0FBQ0EsSUFBSTtBQUNKLEtBQUssT0FBTztBQUNaLElBQUk7QUFDSixHQUFHO0FBQ0g7QUFDQTtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUM1QyxHQUFHLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUNwRCxJQUFJLE9BQU87QUFDWCxLQUFLLEdBQUcsRUFBRSxLQUFLO0FBQ2YsS0FBSyxJQUFJLEVBQUUsZUFBZTtBQUMxQixLQUFLLENBQUM7QUFDTixJQUFJO0FBQ0o7QUFDQSxHQUFHLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDMUQsSUFBSSxPQUFPO0FBQ1gsS0FBSyxHQUFHLEVBQUUsS0FBSztBQUNmLEtBQUssSUFBSSxFQUFFLGdCQUFnQjtBQUMzQixLQUFLLENBQUM7QUFDTixJQUFJO0FBQ0o7QUFDQTtBQUNBLEdBQUcsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUMxRCxJQUFJLE9BQU87QUFDWCxLQUFLLEdBQUcsRUFBRSxLQUFLO0FBQ2YsS0FBSyxJQUFJLEVBQUUsYUFBYTtBQUN4QixLQUFLLENBQUM7QUFDTixJQUFJO0FBQ0osR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEVBQUU7QUFDaEMsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsUUFBUTtBQUNqQixJQUFJLElBQUksRUFBRSx1QkFBdUI7QUFDakMsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQzVDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxnQ0FBZ0M7QUFDMUMsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEVBQUU7QUFDaEMsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLHVDQUF1QztBQUNqRCxJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFO0FBQ0YsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQztBQUMzQixNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDO0FBQzlCLElBQUk7QUFDSixHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsbUNBQW1DO0FBQzdDLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUM1QyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsbUJBQW1CO0FBQzdCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUM1QyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsaUJBQWlCO0FBQzNCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUM1QyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsa0JBQWtCO0FBQzVCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUM1QyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsbUJBQW1CO0FBQzdCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUM1QyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsNEJBQTRCO0FBQ3RDLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0FBQ2hDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLFNBQVM7QUFDbEIsSUFBSSxJQUFJLEVBQUUsdUJBQXVCO0FBQ2pDLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUM1QyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxPQUFPO0FBQ2hCLElBQUksSUFBSSxFQUFFLDJCQUEyQjtBQUNyQyxJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQTtBQUNBO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUNsRCxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsVUFBVTtBQUNwQixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsRUFBRTtBQUNqQyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsV0FBVztBQUNyQixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsRUFBRTtBQUNsQyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsaUJBQWlCO0FBQzNCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUM1QyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsYUFBYTtBQUN2QixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRTtBQUNoQyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxJQUFJO0FBQ2IsSUFBSSxJQUFJLEVBQUUsWUFBWTtBQUN0QixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFO0FBQ0YsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN6QyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzVDLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDNUMsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM1QyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzVDLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDNUMsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM1QyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzVDLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDNUMsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM1QyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzVDLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDNUMsSUFBSTtBQUNKLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSw4QkFBOEI7QUFDeEMsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0E7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDNUM7QUFDQSxHQUFHLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDdEQsSUFBSSxPQUFPO0FBQ1gsS0FBSyxHQUFHLEVBQUUsS0FBSztBQUNmLEtBQUssSUFBSSxFQUFFLFlBQVk7QUFDdkIsS0FBSyxDQUFDO0FBQ04sSUFBSTtBQUNKO0FBQ0E7QUFDQSxHQUFHLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDdEQsSUFBSSxPQUFPO0FBQ1gsS0FBSyxHQUFHLEVBQUUsS0FBSztBQUNmLEtBQUssSUFBSSxFQUFFLFlBQVk7QUFDdkIsS0FBSyxDQUFDO0FBQ04sSUFBSTtBQUNKLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUFFO0FBQ2hDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSw2QkFBNkI7QUFDdkMsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQzVDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLE9BQU87QUFDaEIsSUFBSSxJQUFJLEVBQUUscUJBQXFCO0FBQy9CLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUN4RCxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxJQUFJO0FBQ2IsSUFBSSxJQUFJLEVBQUUsa0JBQWtCO0FBQzVCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxFQUFFO0FBQ2xDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxpQkFBaUI7QUFDM0IsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDeEQsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsSUFBSTtBQUNiLElBQUksSUFBSSxFQUFFLDZCQUE2QjtBQUN2QyxJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFO0FBQ0YsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNsRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDO0FBQ3hELElBQUk7QUFDSixHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsOEJBQThCO0FBQ3hDLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxFQUFFO0FBQ2xDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxXQUFXO0FBQ3JCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQzlCLEdBQUcsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN4RCxHQUFHLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxPQUFPLElBQUksSUFBSSxJQUFJLE9BQU8sSUFBSSxJQUFJLEVBQUU7QUFDbkUsSUFBSSxPQUFPO0FBQ1gsS0FBSyxHQUFHLEVBQUUsS0FBSztBQUNmLEtBQUssSUFBSSxFQUFFLGVBQWU7QUFDMUIsS0FBSyxDQUFDO0FBQ04sSUFBSTtBQUNKLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxFQUFFO0FBQ2xDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLE1BQU07QUFDZixJQUFJLElBQUksRUFBRSxvQkFBb0I7QUFDOUIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxFQUFFO0FBQ25DLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLE9BQU87QUFDaEIsSUFBSSxJQUFJLEVBQUUsdUJBQXVCO0FBQ2pDLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxFQUFFO0FBQ25DLEdBQUcsTUFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzdCLEdBQUcsTUFBTSxNQUFNLEdBQUcsTUFBTSxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUlBLFVBQWdCLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDL0UsR0FBRyxJQUFJLE1BQU0sS0FBSyxlQUFlLEVBQUU7QUFDbkMsSUFBSSxPQUFPO0FBQ1gsS0FBSyxHQUFHLEVBQUUsS0FBSztBQUNmLEtBQUssSUFBSSxFQUFFLG1CQUFtQjtBQUM5QixLQUFLLENBQUM7QUFDTixJQUFJO0FBQ0o7QUFDQSxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxJQUFJO0FBQ2IsSUFBSSxJQUFJLEVBQUUsNEJBQTRCO0FBQ3RDLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQzlDLEdBQUcsTUFBTSxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQzFFLEdBQUcsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQzdDLElBQUksT0FBTztBQUNYLEtBQUssR0FBRyxFQUFFLEtBQUs7QUFDZixLQUFLLElBQUksRUFBRSw4QkFBOEI7QUFDekMsS0FBSyxDQUFDO0FBQ04sSUFBSTtBQUNKLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQ3BFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHLE1BQU0sU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM3QjtBQUNBLEdBQUcsZUFBZSxlQUFlLEdBQUc7QUFDcEMsSUFBSSxPQUFPO0FBQ1gsS0FBSyxNQUFNLEVBQUUsTUFBTSxTQUFTLENBQUMsU0FBUyxDQUFDRSxRQUFjLENBQUM7QUFDdEQsS0FBSyxJQUFJLEVBQUUsTUFBTSxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUlGLFVBQWdCLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ3ZFLEtBQUssQ0FBQztBQUNOLElBQUk7QUFDSjtBQUNBLEdBQUcsR0FBRztBQUNOLElBQUksTUFBTSxLQUFLLEdBQUcsTUFBTSxlQUFlLEVBQUUsQ0FBQztBQUMxQyxJQUFJLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDMUIsS0FBSyxPQUFPO0FBQ1osS0FBSztBQUNMO0FBQ0EsSUFBSSxRQUFRLEtBQUssQ0FBQyxJQUFJO0FBQ3RCLEtBQUssS0FBSyxNQUFNO0FBQ2hCLE1BQU0sT0FBTztBQUNiLE9BQU8sR0FBRyxFQUFFLEtBQUs7QUFDakIsT0FBTyxJQUFJLEVBQUUsV0FBVztBQUN4QixPQUFPLENBQUM7QUFDUixLQUFLLEtBQUssTUFBTTtBQUNoQixNQUFNLE9BQU87QUFDYixPQUFPLEdBQUcsRUFBRSxNQUFNO0FBQ2xCLE9BQU8sSUFBSSxFQUFFLFlBQVk7QUFDekIsT0FBTyxDQUFDO0FBQ1IsS0FBSztBQUNMLE1BQU0sTUFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDL0MsS0FBSztBQUNMLElBQUksUUFBUSxTQUFTLENBQUMsUUFBUSxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRTtBQUM5RDtBQUNBLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxXQUFXO0FBQ3JCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDcEUsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsT0FBTztBQUNoQixJQUFJLElBQUksRUFBRSw0QkFBNEI7QUFDdEMsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUNwRSxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsbUJBQW1CO0FBQzdCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBO0FBQ0EsRUFBRTtBQUNGLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3BELE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3ZELE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3ZELE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3ZELElBQUk7QUFDSixHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsaUJBQWlCO0FBQzNCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUMxRSxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUscUJBQXFCO0FBQy9CLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxFQUFFO0FBQ3JDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxhQUFhO0FBQ3ZCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUM1RixHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsdUJBQXVCO0FBQ2pDLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQ2hGLEdBQUcsZUFBZSxVQUFVLEdBQUc7QUFDL0IsSUFBSSxNQUFNLElBQUksR0FBR0osa0JBQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDbEMsSUFBSSxNQUFNLFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckMsSUFBSSxPQUFPO0FBQ1gsS0FBSyxFQUFFLEVBQUUsSUFBSTtBQUNiLEtBQUssSUFBSSxFQUFFLE1BQU0sQ0FBQyxNQUFNLFNBQVMsQ0FBQyxTQUFTLENBQUNPLFNBQWUsQ0FBQyxDQUFDO0FBQzdELEtBQUssQ0FBQztBQUNOLElBQUk7QUFDSjtBQUNBLEdBQUcsTUFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzlCO0FBQ0EsR0FBRyxPQUFPLFNBQVMsQ0FBQyxRQUFRLEdBQUcsRUFBRSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFO0FBQzdELElBQUksTUFBTSxNQUFNLEdBQUcsTUFBTSxVQUFVLEVBQUUsQ0FBQztBQUN0QyxJQUFJLElBQUksT0FBTyxHQUFHLE1BQU0sQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ25DLElBQUksSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDN0g7QUFDQSxLQUFLLE1BQU0sTUFBTSxHQUFHUCxrQkFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNyQyxLQUFLLE9BQU8sSUFBSSxNQUFNLFNBQVMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDbkQ7QUFDQSxLQUFLLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDM0g7QUFDQSxNQUFNLE9BQU87QUFDYixPQUFPLEdBQUcsRUFBRSxLQUFLO0FBQ2pCLE9BQU8sSUFBSSxFQUFFLGdCQUFnQjtBQUM3QixPQUFPLENBQUM7QUFDUixNQUFNO0FBQ047QUFDQSxLQUFLLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDM0g7QUFDQSxNQUFNLE9BQU87QUFDYixPQUFPLEdBQUcsRUFBRSxLQUFLO0FBQ2pCLE9BQU8sSUFBSSxFQUFFLGdCQUFnQjtBQUM3QixPQUFPLENBQUM7QUFDUixNQUFNO0FBQ047QUFDQSxLQUFLLE1BQU07QUFDWCxLQUFLO0FBQ0w7QUFDQSxJQUFJLE1BQU0sU0FBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUNwQyxJQUFJO0FBQ0o7QUFDQTtBQUNBLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSx3QkFBd0I7QUFDbEMsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDNUYsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLFdBQVc7QUFDckIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQy9ILEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxtQkFBbUI7QUFDN0IsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDekcsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLDBCQUEwQjtBQUNwQyxJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDNUMsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLFdBQVc7QUFDckIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDNUY7QUFDQTtBQUNBLEdBQUcsTUFBTSxTQUFTLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzlCLEdBQUcsTUFBTSxJQUFJLEdBQUcsTUFBTSxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUlJLFVBQWdCLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDNUUsR0FBRyxRQUFRLElBQUk7QUFDZixJQUFJLEtBQUssTUFBTTtBQUNmLEtBQUssT0FBTztBQUNaLE1BQU0sR0FBRyxFQUFFLEtBQUs7QUFDaEIsTUFBTSxJQUFJLEVBQUUsV0FBVztBQUN2QixNQUFNLENBQUM7QUFDUCxJQUFJLEtBQUssTUFBTTtBQUNmLEtBQUssT0FBTztBQUNaLE1BQU0sR0FBRyxFQUFFLEtBQUs7QUFDaEIsTUFBTSxJQUFJLEVBQUUsV0FBVztBQUN2QixNQUFNLENBQUM7QUFDUCxJQUFJLEtBQUssTUFBTTtBQUNmLEtBQUssT0FBTztBQUNaLE1BQU0sR0FBRyxFQUFFLEtBQUs7QUFDaEIsTUFBTSxJQUFJLEVBQUUsV0FBVztBQUN2QixNQUFNLENBQUM7QUFDUCxJQUFJLEtBQUssTUFBTTtBQUNmLEtBQUssT0FBTztBQUNaLE1BQU0sR0FBRyxFQUFFLEtBQUs7QUFDaEIsTUFBTSxJQUFJLEVBQUUsV0FBVztBQUN2QixNQUFNLENBQUM7QUFDUCxJQUFJO0FBQ0osS0FBSyxPQUFPO0FBQ1osSUFBSTtBQUNKLEdBQUc7QUFDSDtBQUNBLEVBQUU7QUFDRixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDM0IsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUMxRixJQUFJO0FBQ0osR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLFdBQVc7QUFDckIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUNoQyxHQUFHLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDeEUsSUFBSSxPQUFPO0FBQ1gsS0FBSyxHQUFHLEVBQUUsS0FBSztBQUNmLEtBQUssSUFBSSxFQUFFLGlCQUFpQjtBQUM1QixLQUFLLENBQUM7QUFDTixJQUFJO0FBQ0o7QUFDQSxHQUFHLE9BQU8sU0FBUyxDQUFDO0FBQ3BCLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxFQUFFO0FBQ0YsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDcEMsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDdkMsSUFBSTtBQUNKLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxZQUFZO0FBQ3RCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDbEQsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLFVBQVU7QUFDcEIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQzVDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxjQUFjO0FBQ3hCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUM1QyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsY0FBYztBQUN4QixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQ3BFO0FBQ0EsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLG1CQUFtQjtBQUM3QixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQTtBQUNBLEVBQUUsTUFBTSxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUM3RztBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUMxRCxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsNEJBQTRCO0FBQ3RDLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsRUFBRTtBQUNsQyxHQUFHLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUMvQyxJQUFJLE9BQU87QUFDWCxLQUFLLEdBQUcsRUFBRSxLQUFLO0FBQ2YsS0FBSyxJQUFJLEVBQUUsWUFBWTtBQUN2QixLQUFLLENBQUM7QUFDTixJQUFJO0FBQ0o7QUFDQSxHQUFHLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUNuRCxJQUFJLE9BQU87QUFDWCxLQUFLLEdBQUcsRUFBRSxLQUFLO0FBQ2YsS0FBSyxJQUFJLEVBQUUsZUFBZTtBQUMxQixLQUFLLENBQUM7QUFDTixJQUFJO0FBQ0osR0FBRztBQUNIO0FBQ0E7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO0FBQzNDLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxzQkFBc0I7QUFDaEMsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsRUFBRTtBQUM1QyxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxJQUFJO0FBQ2IsSUFBSSxJQUFJLEVBQUUsWUFBWTtBQUN0QixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFO0FBQy9DLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxhQUFhO0FBQ3ZCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxFQUFFLEVBQUU7QUFDeEUsR0FBRyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNqRCxHQUFHLElBQUksUUFBUSxHQUFHLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxRQUFRLEdBQUcsRUFBRSxFQUFFO0FBQzdELElBQUksSUFBSTtBQUNSLEtBQUssTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLFFBQVEsR0FBRyxFQUFFLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztBQUNwRSxLQUFLLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDckM7QUFDQSxLQUFLLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTtBQUNyQixNQUFNLE9BQU87QUFDYixPQUFPLEdBQUcsRUFBRSxNQUFNO0FBQ2xCLE9BQU8sSUFBSSxFQUFFLG9CQUFvQjtBQUNqQyxPQUFPLENBQUM7QUFDUixNQUFNO0FBQ04sS0FBSyxDQUFDLE1BQU0sRUFBRTtBQUNkLElBQUk7QUFDSixHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQ3hHLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxpQkFBaUI7QUFDM0IsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUU7QUFDOUMsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLGFBQWE7QUFDdkIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0E7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUU7QUFDL0QsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLFlBQVk7QUFDdEIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0E7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUU7QUFDNUUsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLFlBQVk7QUFDdEIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNsRixHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxNQUFNO0FBQ2YsSUFBSSxJQUFJLEVBQUUsZ0NBQWdDO0FBQzFDLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRTtBQUMzRCxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsbUJBQW1CO0FBQzdCLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDNUksR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLDJCQUEyQjtBQUNyQyxJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDcEgsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsT0FBTztBQUNoQixJQUFJLElBQUksRUFBRSwyQkFBMkI7QUFDckMsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsNEJBQTRCLENBQUMsRUFBRTtBQUN0RCxHQUFHLE9BQU87QUFDVixJQUFJLEdBQUcsRUFBRSxLQUFLO0FBQ2QsSUFBSSxJQUFJLEVBQUUsNEJBQTRCO0FBQ3RDLElBQUksQ0FBQztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUU7QUFDRixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDekM7QUFDQSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQy9DLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDbEQsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNsRCxJQUFJO0FBQ0osSUFBSTtBQUNKLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSwrQkFBK0I7QUFDekMsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQ3BILEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLE1BQU07QUFDZixJQUFJLElBQUksRUFBRSx3QkFBd0I7QUFDbEMsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0E7QUFDQSxFQUFFLE1BQU0sU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDN0c7QUFDQTtBQUNBLEVBQUUsSUFBSSx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUU7QUFDN0MsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLG1CQUFtQjtBQUM3QixJQUFJLENBQUM7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQ2hDLEdBQUcsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUN4RSxJQUFJLE9BQU87QUFDWCxLQUFLLEdBQUcsRUFBRSxLQUFLO0FBQ2YsS0FBSyxJQUFJLEVBQUUsaUJBQWlCO0FBQzVCLEtBQUssQ0FBQztBQUNOLElBQUk7QUFDSjtBQUNBLEdBQUcsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQ3ROLElBQUksT0FBTztBQUNYLEtBQUssR0FBRyxFQUFFLEtBQUs7QUFDZixLQUFLLElBQUksRUFBRSw4QkFBOEI7QUFDekMsS0FBSyxDQUFDO0FBQ04sSUFBSTtBQUNKO0FBQ0EsR0FBRyxPQUFPLFNBQVMsQ0FBQztBQUNwQixHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyw2QkFBNkIsQ0FBQyxFQUFFO0FBQ3ZELEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSwyQkFBMkI7QUFDckMsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0E7QUFDQSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDNUYsR0FBRyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQ3REO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQ3ZELEtBQUssT0FBTztBQUNaLE1BQU0sR0FBRyxFQUFFLEtBQUs7QUFDaEIsTUFBTSxJQUFJLEVBQUUsV0FBVztBQUN2QixNQUFNLENBQUM7QUFDUCxLQUFLO0FBQ0w7QUFDQTtBQUNBLElBQUksT0FBTztBQUNYLEtBQUssR0FBRyxFQUFFLEtBQUs7QUFDZixLQUFLLElBQUksRUFBRSxXQUFXO0FBQ3RCLEtBQUssQ0FBQztBQUNOLElBQUk7QUFDSjtBQUNBO0FBQ0E7QUFDQSxHQUFHLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDdEQsSUFBSSxPQUFPO0FBQ1gsS0FBSyxHQUFHLEVBQUUsS0FBSztBQUNmLEtBQUssSUFBSSxFQUFFLFlBQVk7QUFDdkIsS0FBSyxDQUFDO0FBQ04sSUFBSTtBQUNKO0FBQ0E7QUFDQSxHQUFHLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDdEQsSUFBSSxPQUFPO0FBQ1gsS0FBSyxHQUFHLEVBQUUsS0FBSztBQUNmLEtBQUssSUFBSSxFQUFFLFlBQVk7QUFDdkIsS0FBSyxDQUFDO0FBQ04sSUFBSTtBQUNKO0FBQ0E7QUFDQSxHQUFHLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDdEQsSUFBSSxPQUFPO0FBQ1gsS0FBSyxHQUFHLEVBQUUsS0FBSztBQUNmLEtBQUssSUFBSSxFQUFFLFlBQVk7QUFDdkIsS0FBSyxDQUFDO0FBQ04sSUFBSTtBQUNKLEdBQUc7QUFDSCxFQUFFO0FBQ0Y7QUFDQSxDQUFDLE1BQU0sV0FBVyxDQUFDLFNBQVMsRUFBRTtBQUM5QixFQUFFLE1BQU0sS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxHQUFHSSxTQUFlLEdBQUdDLFNBQWUsQ0FBQyxDQUFDO0FBQzlGLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDNUIsRUFBRSxRQUFRLEtBQUs7QUFDZixHQUFHLEtBQUssTUFBTTtBQUNkLElBQUksT0FBTztBQUNYLEtBQUssR0FBRyxFQUFFLEtBQUs7QUFDZixLQUFLLElBQUksRUFBRSxrQkFBa0I7QUFDN0IsS0FBSyxDQUFDO0FBQ04sR0FBRyxLQUFLLE1BQU07QUFDZCxJQUFJLE9BQU87QUFDWCxLQUFLLEdBQUcsRUFBRSxLQUFLO0FBQ2YsS0FBSyxJQUFJLEVBQUUsbUJBQW1CO0FBQzlCLEtBQUssQ0FBQztBQUVOLEdBQUc7QUFDSCxFQUFFO0FBQ0Y7QUFDQSxDQUFDLE1BQU0sV0FBVyxDQUFDLFNBQVMsRUFBRTtBQUM5QixFQUFFLE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsU0FBUyxHQUFHRCxTQUFlLEdBQUdDLFNBQWUsQ0FBQyxDQUFDO0FBQ3JHLEVBQUUsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFlBQVksRUFBRSxFQUFFLENBQUMsRUFBRTtBQUN6QyxHQUFHLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUN0RCxHQUFHLElBQUksUUFBUSxFQUFFO0FBQ2pCLElBQUksT0FBTyxRQUFRLENBQUM7QUFDcEIsSUFBSTtBQUNKLEdBQUc7QUFDSCxFQUFFO0FBQ0Y7QUFDQSxDQUFDLE1BQU0sY0FBYyxDQUFDLFNBQVMsRUFBRTtBQUNqQyxFQUFFLE1BQU0sT0FBTyxHQUFHLENBQUMsU0FBUyxHQUFHRCxTQUFlLEdBQUdDLFNBQWUsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN0RixFQUFFLE1BQU0sU0FBUyxHQUFHLENBQUMsU0FBUyxHQUFHQyxTQUFlLEdBQUdDLFNBQWUsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN4RjtBQUNBLEVBQUUsSUFBSSxPQUFPLEtBQUssRUFBRSxFQUFFO0FBQ3RCO0FBQ0EsR0FBRyxJQUFJLFNBQVMsSUFBSSxDQUFDLEVBQUU7QUFDdkIsSUFBSSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDN0MsS0FBSyxPQUFPO0FBQ1osTUFBTSxHQUFHLEVBQUUsS0FBSztBQUNoQixNQUFNLElBQUksRUFBRSxtQkFBbUI7QUFDL0IsTUFBTSxDQUFDO0FBQ1AsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLFNBQVMsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUNwSSxLQUFLLE9BQU87QUFDWixNQUFNLEdBQUcsRUFBRSxLQUFLO0FBQ2hCLE1BQU0sSUFBSSxFQUFFLG1CQUFtQjtBQUMvQixNQUFNLENBQUM7QUFDUCxLQUFLO0FBQ0wsSUFBSTtBQUNKO0FBQ0EsR0FBRyxNQUFNLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQzFDLEdBQUcsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3RELEdBQUcsT0FBTyxRQUFRLElBQUk7QUFDdEIsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLFlBQVk7QUFDdEIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLE9BQU8sS0FBSyxFQUFFLEVBQUU7QUFDdEIsR0FBRyxPQUFPO0FBQ1YsSUFBSSxHQUFHLEVBQUUsS0FBSztBQUNkLElBQUksSUFBSSxFQUFFLFlBQVk7QUFDdEIsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNILEVBQUU7QUFDRixDQUFDO0FBS0Q7QUFDbUMsSUFBSSxHQUFHLENBQUMsVUFBVSxFQUFFO0FBQ3JCLElBQUksR0FBRyxDQUFDLFNBQVM7O0FDdnBEbkQsTUFBTSxlQUFlLEdBQUcsSUFBSSxHQUFHLENBQUM7QUFDaEMsQ0FBQyxLQUFLO0FBQ04sQ0FBQyxLQUFLO0FBQ04sQ0FBQyxLQUFLO0FBQ04sQ0FBQyxNQUFNO0FBQ1AsQ0FBQyxNQUFNO0FBQ1AsQ0FBQyxLQUFLO0FBQ04sQ0FBQyxLQUFLO0FBQ04sQ0FBQyxLQUFLO0FBQ04sQ0FBQyxLQUFLO0FBQ04sQ0FBQyxLQUFLO0FBQ04sQ0FBQyxLQUFLO0FBQ04sQ0FBQyxLQUFLO0FBQ04sQ0FBQyxLQUFLO0FBQ04sQ0FBQyxLQUFLO0FBQ04sQ0FBQyxLQUFLO0FBQ04sQ0FBQyxNQUFNO0FBQ1AsQ0FBQyxLQUFLO0FBQ04sQ0FBQyxLQUFLO0FBQ04sQ0FBQyxNQUFNO0FBQ1AsQ0FBQyxDQUFDLENBQUM7QUFDSDtBQUNlLGVBQWUsU0FBUyxDQUFDLEtBQUssRUFBRTtBQUMvQyxDQUFDLE1BQU0sTUFBTSxHQUFHLE1BQU0sa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDaEQsQ0FBQyxPQUFPLGVBQWUsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQztBQUNuRDs7QUMzQkE7QUFFQSxTQUFlLEVBQUU7O0FDRmpCO0FBRUEsU0FBZSxFQUFFOztBQ0ZqQjtBQUVBLFNBQWUsRUFBRTs7QUNGakI7QUFFQSxTQUFlLEVBQUU7O0FDRmpCO0FBRUEsU0FBZTs7QUFFYixJQUFBLGlCQUFpQixFQUFFLGlCQUFpQjtBQUNwQyxJQUFBLG9CQUFvQixFQUFFLG9CQUFvQjtBQUMxQyxJQUFBLHFIQUFxSCxFQUNuSCxxSEFBcUg7QUFDdkgsSUFBQSxrQkFBa0IsRUFBRSxrQkFBa0I7QUFDdEMsSUFBQSxjQUFjLEVBQUUsMkJBQTJCO0FBQzNDLElBQUEsbUJBQW1CLEVBQ2pCLCtFQUErRTtBQUNqRixJQUFBLDJCQUEyQixFQUFFLDJCQUEyQjtBQUN4RCxJQUFBLHFCQUFxQixFQUNuQix3REFBd0Q7QUFDMUQsSUFBQSxjQUFjLEVBQUUsa0RBQWtEO0FBQ2xFLElBQUEsa0NBQWtDLEVBQUUsNEJBQTRCO0FBQ2hFLElBQUEsNEJBQTRCLEVBQUUsNEJBQTRCO0FBQzFELElBQUEsaUJBQWlCLEVBQUUsaUJBQWlCO0FBQ3BDLElBQUEscUJBQXFCLEVBQUUscUJBQXFCO0FBQzVDLElBQUEsZUFBZSxFQUFFLGVBQWU7QUFDaEMsSUFBQSxtQkFBbUIsRUFBRSxtQkFBbUI7QUFDeEMsSUFBQSwrQkFBK0IsRUFBRSxtQ0FBbUM7QUFDcEUsSUFBQSxnQ0FBZ0MsRUFBRSxnQ0FBZ0M7QUFDbEUsSUFBQSx5QkFBeUIsRUFBRSx5QkFBeUI7QUFDcEQsSUFBQSxtRUFBbUUsRUFDakUsbUVBQW1FO0FBQ3JFLElBQUEsaUJBQWlCLEVBQUUsaUJBQWlCO0FBQ3BDLElBQUEsNkJBQTZCLEVBQzNCLHdJQUF3STtBQUMxSSxJQUFBLE9BQU8sRUFBRSxTQUFTO0FBQ2xCLElBQUEsY0FBYyxFQUNaLDBMQUEwTDtBQUM1TCxJQUFBLG1EQUFtRCxFQUNqRCxtREFBbUQ7QUFDckQsSUFBQSxxR0FBcUcsRUFDbkcscUdBQXFHO0FBQ3ZHLElBQUEsMkJBQTJCLEVBQUUsMkJBQTJCO0FBQ3hELElBQUEsdUNBQXVDLEVBQ3JDLGlFQUFpRTtBQUNuRSxJQUFBLDBDQUEwQyxFQUN4QywwQ0FBMEM7QUFDNUMsSUFBQSx3REFBd0QsRUFDdEQsd0RBQXdEO0FBQzFELElBQUEsWUFBWSxFQUFFLFlBQVk7QUFDMUIsSUFBQSxPQUFPLEVBQUUsU0FBUztBQUNsQixJQUFBLFlBQVksRUFBRSxNQUFNO0FBQ3BCLElBQUEsZ0JBQWdCLEVBQUUsa0JBQWtCO0FBQ3BDLElBQUEsb0JBQW9CLEVBQUUsb0JBQW9CO0FBQzFDLElBQUEseUJBQXlCLEVBQ3ZCLDZEQUE2RDtBQUMvRCxJQUFBLHlCQUF5QixFQUFFLHlCQUF5QjtBQUNwRCxJQUFBLHdDQUF3QyxFQUN0Qyx3Q0FBd0M7QUFDMUMsSUFBQSwwQ0FBMEMsRUFDeEMsMENBQTBDO0FBQzVDLElBQUEsOERBQThELEVBQzVELGtFQUFrRTtDQUNyRTs7QUMxREQ7QUFFQSxXQUFlLEVBQUU7O0FDRmpCO0FBRUEsU0FBZSxFQUFFOztBQ0ZqQjtBQUVBLFNBQWUsRUFBRTs7QUNGakI7QUFFQSxTQUFlLEVBQUU7O0FDRmpCO0FBRUEsU0FBZSxFQUFFOztBQ0ZqQjtBQUVBLFNBQWUsRUFBRTs7QUNGakI7QUFFQSxTQUFlLEVBQUU7O0FDRmpCO0FBRUEsU0FBZSxFQUFFOztBQ0ZqQjtBQUVBLFNBQWUsRUFBRTs7QUNGakI7QUFFQSxTQUFlLEVBQUU7O0FDRmpCO0FBRUEsU0FBZSxFQUFFOztBQ0ZqQjtBQUVBLFNBQWUsRUFBRTs7QUNGakI7QUFDQTtBQUVBLFdBQWUsRUFBRTs7QUNIakI7QUFFQSxTQUFlLEVBQUU7O0FDRmpCO0FBRUEsU0FBZSxFQUFFOztBQ0ZqQjtBQUVBLFNBQWUsRUFBRTs7QUNGakI7QUFFQSxXQUFlOztBQUViLElBQUEsaUJBQWlCLEVBQUUsTUFBTTtBQUN6QixJQUFBLG9CQUFvQixFQUFFLFNBQVM7QUFDL0IsSUFBQSxxSEFBcUgsRUFDbkgsaUNBQWlDO0FBQ25DLElBQUEsa0JBQWtCLEVBQUUsT0FBTztBQUMzQixJQUFBLGNBQWMsRUFBRSxtQkFBbUI7QUFDbkMsSUFBQSxtQkFBbUIsRUFBRSxrQ0FBa0M7QUFDdkQsSUFBQSwyQkFBMkIsRUFBRSxXQUFXO0FBQ3hDLElBQUEscUJBQXFCLEVBQUUscUNBQXFDO0FBQzVELElBQUEsY0FBYyxFQUFFLHVDQUF1QztBQUN2RCxJQUFBLGtDQUFrQyxFQUFFLFdBQVc7QUFDL0MsSUFBQSw0QkFBNEIsRUFBRSxpQkFBaUI7QUFDL0MsSUFBQSxpQkFBaUIsRUFBRSxlQUFlO0FBQ2xDLElBQUEscUJBQXFCLEVBQUUsTUFBTTtBQUM3QixJQUFBLGVBQWUsRUFBRSxNQUFNO0FBQ3ZCLElBQUEseUJBQXlCLEVBQUUsU0FBUztBQUNwQyxJQUFBLG1CQUFtQixFQUFFLFFBQVE7QUFDN0IsSUFBQSwrQkFBK0IsRUFBRSxrQkFBa0I7QUFDbkQsSUFBQSxnQ0FBZ0MsRUFBRSxXQUFXO0FBQzdDLElBQUEsbUVBQW1FLEVBQ2pFLDhCQUE4QjtBQUNoQyxJQUFBLGlCQUFpQixFQUFFLFFBQVE7QUFDM0IsSUFBQSw2QkFBNkIsRUFDM0IsZ0RBQWdEO0FBQ2xELElBQUEsT0FBTyxFQUFFLFVBQVU7QUFDbkIsSUFBQSxjQUFjLEVBQ1osOEZBQThGO0FBQ2hHLElBQUEsbURBQW1ELEVBQ2pELDJCQUEyQjtBQUM3QixJQUFBLHFHQUFxRyxFQUNuRywyQ0FBMkM7QUFDN0MsSUFBQSwyQkFBMkIsRUFBRSxXQUFXO0FBQ3hDLElBQUEsdUNBQXVDLEVBQ3JDLHlCQUF5QjtBQUMzQixJQUFBLDBDQUEwQyxFQUFFLFlBQVk7QUFDeEQsSUFBQSx3REFBd0QsRUFDdEQscUJBQXFCO0FBQ3ZCLElBQUEsWUFBWSxFQUFFLE1BQU07QUFDcEIsSUFBQSxPQUFPLEVBQUUsSUFBSTtBQUNiLElBQUEsWUFBWSxFQUFFLEdBQUc7QUFDakIsSUFBQSxnQkFBZ0IsRUFBRSxhQUFhO0FBQy9CLElBQUEsb0JBQW9CLEVBQUUsU0FBUztBQUMvQixJQUFBLHlCQUF5QixFQUFFLGlDQUFpQztBQUM1RCxJQUFBLHlCQUF5QixFQUFFLFdBQVc7QUFDdEMsSUFBQSx3Q0FBd0MsRUFBRSxjQUFjO0FBQ3hELElBQUEsMENBQTBDLEVBQUUsY0FBYztBQUMxRCxJQUFBLDhEQUE4RCxFQUM1RCx1QkFBdUI7Q0FDMUI7O0FDcEREO0FBRUEsV0FBZSxFQUFFOztBQ3dCakIsTUFBTSxTQUFTLEdBQXdDO0lBQ3JELEVBQUU7QUFDRixJQUFBLEVBQUUsRUFBRSxFQUFFO0lBQ04sRUFBRTtJQUNGLEVBQUU7SUFDRixFQUFFO0FBQ0YsSUFBQSxPQUFPLEVBQUUsSUFBSTtJQUNiLEVBQUU7SUFDRixFQUFFO0lBQ0YsRUFBRTtJQUNGLEVBQUU7SUFDRixFQUFFO0lBQ0YsRUFBRTtJQUNGLEVBQUU7SUFDRixFQUFFO0FBQ0YsSUFBQSxFQUFFLEVBQUUsRUFBRTtJQUNOLEVBQUU7SUFDRixFQUFFO0FBQ0YsSUFBQSxPQUFPLEVBQUUsSUFBSTtJQUNiLEVBQUU7SUFDRixFQUFFO0lBQ0YsRUFBRTtBQUNGLElBQUEsT0FBTyxFQUFFLElBQUk7QUFDYixJQUFBLE9BQU8sRUFBRSxJQUFJO0NBQ2QsQ0FBQztBQUVGLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQ0MsZUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFFcEMsU0FBVSxDQUFDLENBQUMsR0FBb0IsRUFBQTtBQUNwQyxJQUFBLE9BQU8sQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM1Qzs7QUMvQ08sZUFBZSxxQkFBcUIsQ0FBQyxNQUE2QixFQUFBO0lBQ3ZFLE1BQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGFBQWEsRUFBRSxDQUFDO0FBQ3hELElBQUEsTUFBTSxVQUFVLEdBQUcsTUFBTSxNQUFNLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyw2QkFBNkIsQ0FDM0UsRUFBRSxDQUNILENBQUM7SUFFRixNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDO0FBRTlDLElBQUEsSUFBSSxFQUFFLE1BQU0sTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFO0FBQ3hELFFBQUEsTUFBTSxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQ2xEO0lBRUQsSUFBSSxVQUFVLEdBQUcsRUFBRSxDQUFDO0FBQ3BCLElBQUEsS0FBSyxNQUFNLElBQUksSUFBSSxTQUFTLEVBQUU7UUFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ2pDLFNBQVM7U0FDVjtBQUVELFFBQUEsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztBQUN0QixRQUFBLE1BQU0sS0FBSyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUMvQixRQUFBLElBQUksSUFBSSxHQUFHLFNBQVMsQ0FBQ3ZFLG9CQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLGtCQUFrQixFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBRTVFLFFBQUEsTUFBTSxRQUFRLEdBQUcsTUFBTSxRQUFRLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDL0QsUUFBQSxJQUFJLFFBQVEsQ0FBQyxFQUFFLEVBQUU7QUFDZixZQUFBLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGFBQWEsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7WUFFdEUsVUFBVSxDQUFDLElBQUksQ0FBQztnQkFDZCxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07QUFDbkIsZ0JBQUEsSUFBSSxFQUFFLElBQUk7QUFDVixnQkFBQSxJQUFJLEVBQUV3RSxzQkFBYSxDQUNqQkMsdUJBQVEsQ0FBQ0Qsc0JBQWEsQ0FBQyxZQUFZLENBQUMsRUFBRUEsc0JBQWEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FDcEU7QUFDRixhQUFBLENBQUMsQ0FBQztTQUNKO0tBQ0Y7SUFFRCxJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBQ3JDLElBQUEsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUc7UUFDckIsSUFBSSxJQUFJLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFekMsS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFBLEVBQUEsRUFBSyxJQUFJLENBQUssRUFBQSxFQUFBLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUEsQ0FBQSxDQUFHLENBQUMsQ0FBQztBQUM5RSxLQUFDLENBQUMsQ0FBQztJQUVILE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGFBQWEsRUFBRSxDQUFDO0lBQ3pELElBQUksVUFBVSxDQUFDLElBQUksS0FBSyxXQUFXLENBQUMsSUFBSSxFQUFFO0FBQ3hDLFFBQUEsSUFBSXRCLGVBQU0sQ0FBQyxDQUFDLENBQUMsMENBQTBDLENBQUMsQ0FBQyxDQUFDO1FBQzFELE9BQU87S0FDUjtBQUNELElBQUEsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7SUFFOUIsSUFBSUEsZUFBTSxDQUNSLENBQVEsS0FBQSxFQUFBLFNBQVMsQ0FBQyxNQUFNLENBQUEsV0FBQSxFQUFjLFVBQVUsQ0FBQyxNQUFNLGFBQ3JELFNBQVMsQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDLE1BQ2hDLENBQUEsQ0FBRSxDQUNILENBQUM7QUFDSixDQUFDO0FBRUQsZUFBZSxRQUFRLENBQ3JCLE1BQTZCLEVBQzdCLEdBQVcsRUFDWCxVQUFrQixFQUNsQixJQUFZLEVBQUE7SUFFWixNQUFNLFFBQVEsR0FBRyxNQUFNd0IsbUJBQVUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7QUFFM0MsSUFBQSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssR0FBRyxFQUFFO1FBQzNCLE9BQU87QUFDTCxZQUFBLEVBQUUsRUFBRSxLQUFLO0FBQ1QsWUFBQSxHQUFHLEVBQUUsT0FBTztTQUNiLENBQUM7S0FDSDtBQUVELElBQUEsTUFBTSxJQUFJLEdBQUcsTUFBTSxTQUFTLENBQUMsSUFBSSxVQUFVLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFDbkUsSUFBSSxDQUFDLElBQUksRUFBRTtRQUNULE9BQU87QUFDTCxZQUFBLEVBQUUsRUFBRSxLQUFLO0FBQ1QsWUFBQSxHQUFHLEVBQUUsT0FBTztTQUNiLENBQUM7S0FDSDtBQUVELElBQUEsSUFBSTtBQUNGLFFBQUEsSUFBSSxJQUFJLEdBQUdGLHNCQUFhLENBQUNHLG1CQUFJLENBQUMsVUFBVSxFQUFFLENBQUcsRUFBQSxJQUFJLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBRSxDQUFBLENBQUMsQ0FBQyxDQUFDOztBQUdsRSxRQUFBLElBQUksTUFBTSxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQy9DLFlBQUEsSUFBSSxHQUFHSCxzQkFBYSxDQUFDRyxtQkFBSSxDQUFDLFVBQVUsRUFBRSxDQUFBLEVBQUcsSUFBSSxFQUFFLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBRSxDQUFBLENBQUMsQ0FBQyxDQUFDO1NBQ2pFO0FBRUQsUUFBQSxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDakUsT0FBTztBQUNMLFlBQUEsRUFBRSxFQUFFLElBQUk7QUFDUixZQUFBLEdBQUcsRUFBRSxJQUFJO0FBQ1QsWUFBQSxJQUFJLEVBQUUsSUFBSTtZQUNWLElBQUk7U0FDTCxDQUFDO0tBQ0g7SUFBQyxPQUFPLEdBQUcsRUFBRTtRQUNaLE9BQU87QUFDTCxZQUFBLEVBQUUsRUFBRSxLQUFLO0FBQ1QsWUFBQSxHQUFHLEVBQUUsR0FBRztTQUNULENBQUM7S0FDSDtBQUNIOztNQ2hHYSxhQUFhLENBQUE7QUFDeEIsSUFBQSxRQUFRLENBQWlCO0FBQ3pCLElBQUEsTUFBTSxDQUF3QjtJQUU5QixXQUFZLENBQUEsUUFBd0IsRUFBRSxNQUE2QixFQUFBO0FBQ2pFLFFBQUEsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7QUFDekIsUUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztLQUN0QjtJQUVELE1BQU0sV0FBVyxDQUFDLFFBQXVCLEVBQUE7QUFDdkMsUUFBQSxJQUFJLFFBQWEsQ0FBQztBQUNsQixRQUFBLElBQUksSUFBbUIsQ0FBQztBQUV4QixRQUFBLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRTtZQUNsQyxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUM7QUFDakIsWUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUN4QyxnQkFBQSxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pCLE1BQU0sTUFBTSxHQUFXLE1BQU0sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFJO29CQUMzREMsbUJBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxHQUFHLEVBQUUsSUFBSSxLQUFJO3dCQUMzQixJQUFJLEdBQUcsRUFBRTs0QkFDUCxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7eUJBQ2I7d0JBQ0QsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2hCLHFCQUFDLENBQUMsQ0FBQztBQUNMLGlCQUFDLENBQUMsQ0FBQztBQUNILGdCQUFBLE1BQU0sV0FBVyxHQUFHLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2hELGdCQUFBLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO2FBQzNDO1lBQ0QsUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzlDLFlBQUEsSUFBSSxHQUFHLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO1NBQzlCO2FBQU07WUFDTCxRQUFRLEdBQUcsTUFBTUYsbUJBQVUsQ0FBQztBQUMxQixnQkFBQSxHQUFHLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZO0FBQy9CLGdCQUFBLE1BQU0sRUFBRSxNQUFNO0FBQ2QsZ0JBQUEsT0FBTyxFQUFFLEVBQUUsY0FBYyxFQUFFLGtCQUFrQixFQUFFO2dCQUMvQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQztBQUN6QyxhQUFBLENBQUMsQ0FBQztBQUNILFlBQUEsSUFBSSxHQUFHLE1BQU0sUUFBUSxDQUFDLElBQUksQ0FBQztTQUM1Qjs7QUFHRCxRQUFBLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtBQUNuQixZQUFBLE1BQU0sdUJBQXVCLEdBQUcsSUFBSSxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUM7QUFDdEQsWUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsR0FBRztnQkFDN0IsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsSUFBSSxFQUFFLENBQUM7QUFDdkMsZ0JBQUEsR0FBRyx1QkFBdUI7YUFDM0IsQ0FBQztTQUNIO0FBRUQsUUFBQSxPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsTUFBTSxnQkFBZ0IsQ0FBQyxRQUEyQixFQUFBO0FBQ2hELFFBQUEsTUFBTSxJQUFJLEdBQUcsSUFBSSxRQUFRLEVBQUUsQ0FBQztBQUM1QixRQUFBLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3hDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ2xDO0FBRUQsUUFBQSxNQUFNLE9BQU8sR0FBRztBQUNkLFlBQUEsTUFBTSxFQUFFLE1BQU07QUFDZCxZQUFBLElBQUksRUFBRSxJQUFJO1NBQ1gsQ0FBQztBQUVGLFFBQUEsTUFBTSxRQUFRLEdBQUcsTUFBTSxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDbEUsUUFBQSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNsQyxRQUFBLE9BQU8sUUFBUSxDQUFDO0tBQ2pCO0lBRUQsTUFBTSxxQkFBcUIsQ0FBQyxRQUFtQixFQUFBO0FBQzdDLFFBQUEsSUFBSSxJQUFtQixDQUFDO0FBQ3hCLFFBQUEsSUFBSSxHQUFRLENBQUM7QUFFYixRQUFBLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRTtZQUNsQyxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDNUMsWUFBQSxJQUFJLEdBQUcsTUFBTSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7U0FDekI7YUFBTTtZQUNMLEdBQUcsR0FBRyxNQUFNQSxtQkFBVSxDQUFDO0FBQ3JCLGdCQUFBLEdBQUcsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVk7QUFDL0IsZ0JBQUEsTUFBTSxFQUFFLE1BQU07QUFDZixhQUFBLENBQUMsQ0FBQztBQUVILFlBQUEsSUFBSSxHQUFHLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQztTQUN2QjtBQUVELFFBQUEsSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLEdBQUcsRUFBRTtZQUN0QixPQUFPO2dCQUNMLElBQUksRUFBRSxDQUFDLENBQUM7Z0JBQ1IsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHO0FBQ2IsZ0JBQUEsSUFBSSxFQUFFLEVBQUU7YUFDVCxDQUFDO1NBQ0g7O0FBR0QsUUFBQSxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7QUFDbkIsWUFBQSxNQUFNLHVCQUF1QixHQUFHLElBQUksQ0FBQyxVQUFVLElBQUksRUFBRSxDQUFDO0FBQ3RELFlBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEdBQUc7Z0JBQzdCLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLElBQUksRUFBRSxDQUFDO0FBQ3ZDLGdCQUFBLEdBQUcsdUJBQXVCO2FBQzNCLENBQUM7QUFDRixZQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7U0FDNUI7UUFFRCxPQUFPO0FBQ0wsWUFBQSxJQUFJLEVBQUUsQ0FBQztBQUNQLFlBQUEsR0FBRyxFQUFFLFNBQVM7WUFDZCxJQUFJLEVBQUUsT0FBTyxJQUFJLENBQUMsTUFBTSxJQUFJLFFBQVEsR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1NBQ3BFLENBQUM7S0FDSDtBQUNGLENBQUE7TUFFWSxpQkFBaUIsQ0FBQTtBQUM1QixJQUFBLFFBQVEsQ0FBaUI7QUFDekIsSUFBQSxNQUFNLENBQXdCO0lBRTlCLFdBQVksQ0FBQSxRQUF3QixFQUFFLE1BQTZCLEVBQUE7QUFDakUsUUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztBQUN6QixRQUFBLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0tBQ3RCO0lBRUQsTUFBTSxXQUFXLENBQUMsUUFBdUIsRUFBQTtBQUN2QyxRQUFBLE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUM7UUFDL0IsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLElBQUksT0FBTyxDQUFDO0FBQ2pELFFBQUEsSUFBSSxPQUFPLEdBQUcsQ0FBRyxFQUFBLEdBQUcsV0FBVyxRQUFRO2FBQ3BDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBSSxDQUFBLEVBQUEsSUFBSSxHQUFHLENBQUM7QUFDeEIsYUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUEsQ0FBRSxDQUFDO1FBRWYsTUFBTSxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sU0FBUyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEMsUUFBQSxNQUFNLGVBQWUsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDO0FBRXpDLFFBQUEsTUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQyxlQUFlLEdBQUcsQ0FBQyxHQUFHLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztBQUVwRSxRQUFBLElBQUksR0FBRyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsRUFBRTtBQUMvQixZQUFBLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBRTFCLE9BQU87QUFDTCxnQkFBQSxPQUFPLEVBQUUsS0FBSztBQUNkLGdCQUFBLEdBQUcsRUFBRSxJQUFJO2FBQ1YsQ0FBQztTQUNIO2FBQU07WUFDTCxPQUFPO0FBQ0wsZ0JBQUEsT0FBTyxFQUFFLElBQUk7QUFDYixnQkFBQSxNQUFNLEVBQUUsSUFBSTthQUNiLENBQUM7U0FDSDs7S0FFRjs7QUFHRCxJQUFBLE1BQU0scUJBQXFCLEdBQUE7QUFDekIsUUFBQSxNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUN0QyxNQUFNLFNBQVMsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xDLFFBQUEsTUFBTSxTQUFTLEdBQUcsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRTFDLElBQUksU0FBUyxFQUFFO1lBQ2IsT0FBTztBQUNMLGdCQUFBLElBQUksRUFBRSxDQUFDO0FBQ1AsZ0JBQUEsR0FBRyxFQUFFLFNBQVM7QUFDZCxnQkFBQSxJQUFJLEVBQUUsU0FBUzthQUNoQixDQUFDO1NBQ0g7YUFBTTtBQUNMLFlBQUEsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQzs7WUFHdkIsT0FBTztnQkFDTCxJQUFJLEVBQUUsQ0FBQyxDQUFDO2dCQUNSLEdBQUcsRUFBRSxDQUFxQyxrQ0FBQSxFQUFBLEdBQUcsQ0FBRSxDQUFBO0FBQy9DLGdCQUFBLElBQUksRUFBRSxFQUFFO2FBQ1QsQ0FBQztTQUNIO0tBQ0Y7O0FBR0QsSUFBQSxNQUFNLFlBQVksR0FBQTtBQUNoQixRQUFBLElBQUksT0FBTyxDQUFDO0FBQ1osUUFBQSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxFQUFFO1lBQy9CLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxTQUFTLENBQUM7U0FDbkQ7YUFBTTtZQUNMLE9BQU8sR0FBRyxjQUFjLENBQUM7U0FDMUI7UUFDRCxNQUFNLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7O0FBR3JDLFFBQUEsT0FBTyxHQUFHLENBQUM7S0FDWjtJQUVELE1BQU0sSUFBSSxDQUFDLE9BQWUsRUFBQTtRQUN4QixJQUFJLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTUcsaUJBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUNyQyxRQUFBLE1BQU0sR0FBRyxHQUFHLE1BQU0sY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3pDLFFBQUEsT0FBTyxHQUFHLENBQUM7S0FDWjtBQUVELElBQUEsTUFBTSxVQUFVLEdBQUE7UUFDZCxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQzNDLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRTtBQUN2QyxZQUFBLEtBQUssRUFBRSxJQUFJO0FBQ1osU0FBQSxDQUFDLENBQUM7UUFFSCxJQUFJLElBQUksR0FBRyxFQUFFLENBQUM7UUFDZCxXQUFXLE1BQU0sS0FBSyxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUU7WUFDdEMsSUFBSSxJQUFJLEtBQUssQ0FBQztTQUNmO1FBQ0QsSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDO1FBQ2YsV0FBVyxNQUFNLEtBQUssSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFO1lBQ3RDLEtBQUssSUFBSSxLQUFLLENBQUM7U0FDaEI7UUFDRCxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSTtBQUNyRCxZQUFBLEtBQUssQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQzdCLFNBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxRQUFRLEVBQUU7WUFDWixNQUFNLElBQUksS0FBSyxDQUFDLENBQUEsc0JBQUEsRUFBeUIsUUFBUSxDQUFLLEVBQUEsRUFBQSxLQUFLLENBQUUsQ0FBQSxDQUFDLENBQUM7U0FDaEU7QUFDRCxRQUFBLE9BQU8sSUFBSSxDQUFDO0tBQ2I7QUFDRjs7TUNqT1ksWUFBWSxDQUFBO0FBQ3ZCLElBQUEsTUFBTSxDQUF3QjtBQUU5QixJQUFBLFdBQUEsQ0FBWSxNQUE2QixFQUFBO0FBQ3ZDLFFBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7S0FDdEI7SUFFRCxNQUFNLFdBQVcsQ0FBQyxTQUErQixFQUFBO0FBQy9DLFFBQUEsTUFBTSxRQUFRLEdBQUcsTUFBTUgsbUJBQVUsQ0FBQztBQUNoQyxZQUFBLEdBQUcsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxZQUFZO0FBQ3RDLFlBQUEsTUFBTSxFQUFFLE1BQU07QUFDZCxZQUFBLE9BQU8sRUFBRSxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRTtBQUMvQyxZQUFBLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO0FBQ25CLGdCQUFBLElBQUksRUFBRSxTQUFTO2FBQ2hCLENBQUM7QUFDSCxTQUFBLENBQUMsQ0FBQztBQUNILFFBQUEsTUFBTSxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQztBQUMzQixRQUFBLE9BQU8sSUFBSSxDQUFDO0tBQ2I7QUFDRjs7QUNmRDtBQUNBO0FBQ0EsTUFBTSxVQUFVLEdBQ2QsdUdBQXVHLENBQUM7QUFDMUcsTUFBTSxlQUFlLEdBQUcsOEJBQThCLENBQUM7QUFFekMsTUFBTyxNQUFNLENBQUE7QUFDekIsSUFBQSxHQUFHLENBQU07QUFFVCxJQUFBLFdBQUEsQ0FBWSxHQUFRLEVBQUE7QUFDbEIsUUFBQSxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztLQUNoQjtBQUVELElBQUEsbUJBQW1CLENBQUMsR0FBVyxFQUFFLFlBQUEsR0FBb0IsU0FBUyxFQUFBO1FBQzVELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ2hELElBQUksQ0FBQyxJQUFJLEVBQUU7QUFDVCxZQUFBLE9BQU8sU0FBUyxDQUFDO1NBQ2xCO0FBQ0QsUUFBQSxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQ3ZCLFFBQUEsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXBELElBQUksS0FBSyxHQUFHLFlBQVksQ0FBQztBQUN6QixRQUFBLElBQUksS0FBSyxFQUFFLFdBQVcsSUFBSSxLQUFLLENBQUMsV0FBVyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUMvRCxZQUFBLEtBQUssR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ2hDO0FBQ0QsUUFBQSxPQUFPLEtBQUssQ0FBQztLQUNkO0lBRUQsU0FBUyxHQUFBO0FBQ1AsUUFBQSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQ0kscUJBQVksQ0FBQyxDQUFDO1FBQ3BFLElBQUksTUFBTSxFQUFFO1lBQ1YsT0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDO1NBQ3RCO2FBQU07QUFDTCxZQUFBLE9BQU8sSUFBSSxDQUFDO1NBQ2I7S0FDRjtJQUVELFFBQVEsR0FBQTtBQUNOLFFBQUEsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO0FBQ2hDLFFBQUEsT0FBTyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7S0FDMUI7QUFFRCxJQUFBLFFBQVEsQ0FBQyxLQUFhLEVBQUE7QUFDcEIsUUFBQSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDaEMsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxNQUFNLENBQUMsYUFBYSxFQUFFLENBQUM7QUFDN0MsUUFBQSxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7QUFFcEMsUUFBQSxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3ZCLFFBQUEsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDM0IsUUFBQSxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0tBQzVCOztJQUdELFdBQVcsR0FBQTtBQUNULFFBQUEsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO0FBQ2hDLFFBQUEsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBQzlCLFFBQUEsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ2pDO0FBRUQsSUFBQSxZQUFZLENBQUMsS0FBYSxFQUFBO1FBQ3hCLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDM0MsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUVwRCxJQUFJLFNBQVMsR0FBWSxFQUFFLENBQUM7QUFFNUIsUUFBQSxLQUFLLE1BQU0sS0FBSyxJQUFJLE9BQU8sRUFBRTtBQUMzQixZQUFBLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUV4QixZQUFBLElBQUksSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQixZQUFBLElBQUksSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQixZQUFBLElBQUksSUFBSSxLQUFLLFNBQVMsRUFBRTtBQUN0QixnQkFBQSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ2pCO0FBQ0QsWUFBQSxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUU7QUFDdEIsZ0JBQUEsSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNqQjtZQUVELFNBQVMsQ0FBQyxJQUFJLENBQUM7QUFDYixnQkFBQSxJQUFJLEVBQUUsSUFBSTtBQUNWLGdCQUFBLElBQUksRUFBRSxJQUFJO0FBQ1YsZ0JBQUEsTUFBTSxFQUFFLE1BQU07QUFDZixhQUFBLENBQUMsQ0FBQztTQUNKO0FBRUQsUUFBQSxLQUFLLE1BQU0sS0FBSyxJQUFJLFdBQVcsRUFBRTtZQUMvQixJQUFJLElBQUksR0FBRzlFLG9CQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQ2hDLFlBQUEsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RCLFlBQUEsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3hCLFlBQUEsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ1osSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFBLEVBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUUsQ0FBQzthQUM3QjtZQUNELFNBQVMsQ0FBQyxJQUFJLENBQUM7QUFDYixnQkFBQSxJQUFJLEVBQUUsSUFBSTtBQUNWLGdCQUFBLElBQUksRUFBRSxJQUFJO0FBQ1YsZ0JBQUEsTUFBTSxFQUFFLE1BQU07QUFDZixhQUFBLENBQUMsQ0FBQztTQUNKO0FBRUQsUUFBQSxPQUFPLFNBQVMsQ0FBQztLQUNsQjtJQUVELGNBQWMsQ0FBQyxHQUFXLEVBQUUsWUFBb0IsRUFBQTtBQUM5QyxRQUFBLElBQUksWUFBWSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsRUFBRTtBQUM5QixZQUFBLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7QUFDRCxRQUFBLE1BQU0sZUFBZSxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDNUUsUUFBQSxJQUFJLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN2QixRQUFBLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUM7QUFFNUIsUUFBQSxPQUFPLGVBQWUsQ0FBQyxJQUFJLENBQUMsV0FBVyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztLQUMxRTtBQUNGOztBQy9GTSxNQUFNLGdCQUFnQixHQUFtQjtBQUM5QyxJQUFBLGtCQUFrQixFQUFFLElBQUk7QUFDeEIsSUFBQSxRQUFRLEVBQUUsT0FBTztBQUNqQixJQUFBLFlBQVksRUFBRSwrQkFBK0I7QUFDN0MsSUFBQSxZQUFZLEVBQUUsK0JBQStCO0FBQzdDLElBQUEsZUFBZSxFQUFFLEVBQUU7QUFDbkIsSUFBQSxhQUFhLEVBQUUsRUFBRTtBQUNqQixJQUFBLGFBQWEsRUFBRSxLQUFLO0FBQ3BCLElBQUEsT0FBTyxFQUFFLEtBQUs7QUFDZCxJQUFBLFVBQVUsRUFBRSxJQUFJO0FBQ2hCLElBQUEsbUJBQW1CLEVBQUUsRUFBRTtBQUN2QixJQUFBLFlBQVksRUFBRSxLQUFLO0FBQ25CLElBQUEsZUFBZSxFQUFFLElBQUk7QUFDckIsSUFBQSxTQUFTLEVBQUUsUUFBUTtBQUNuQixJQUFBLGdCQUFnQixFQUFFLEtBQUs7QUFDdkIsSUFBQSxVQUFVLEVBQUUsSUFBSTtDQUNqQixDQUFDO0FBRUksTUFBTyxVQUFXLFNBQVErRSx5QkFBZ0IsQ0FBQTtBQUM5QyxJQUFBLE1BQU0sQ0FBd0I7SUFDdEIsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDO0lBQ3pCLFVBQVUsR0FBRyxLQUFLLENBQUM7SUFDbkIsY0FBYyxHQUFHLENBQUMsQ0FBQztJQUNuQixtQkFBbUIsR0FBRyxFQUFFLENBQUM7SUFDekIsYUFBYSxHQUFHLEVBQUUsQ0FBQztJQUUzQixXQUFZLENBQUEsR0FBUSxFQUFFLE1BQTZCLEVBQUE7QUFDakQsUUFBQSxLQUFLLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ25CLFFBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7S0FDdEI7SUFFRCxPQUFPLEdBQUE7QUFDTCxRQUFBLElBQUksRUFBRSxXQUFXLEVBQUUsR0FBRyxJQUFJLENBQUM7QUFFM0IsUUFBQSxNQUFNLEVBQUUsR0FBRyxLQUFLLEVBQUUsQ0FBQztRQUVuQixXQUFXLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDcEIsUUFBQSxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsaUJBQWlCLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDM0QsSUFBSUMsZ0JBQU8sQ0FBQyxXQUFXLENBQUM7QUFDckIsYUFBQSxPQUFPLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLENBQUM7QUFDaEMsYUFBQSxPQUFPLENBQ04sQ0FBQyxDQUNDLHFIQUFxSCxDQUN0SCxDQUNGO0FBQ0EsYUFBQSxTQUFTLENBQUMsTUFBTSxJQUNmLE1BQU07YUFDSCxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsa0JBQWtCLENBQUM7QUFDakQsYUFBQSxRQUFRLENBQUMsT0FBTSxLQUFLLEtBQUc7WUFDdEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsa0JBQWtCLEdBQUcsS0FBSyxDQUFDO0FBQ2hELFlBQUEsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ2xDLENBQUMsQ0FDTCxDQUFDO1FBRUosSUFBSUEsZ0JBQU8sQ0FBQyxXQUFXLENBQUM7QUFDckIsYUFBQSxPQUFPLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFDOUIsYUFBQSxPQUFPLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFDOUIsYUFBQSxXQUFXLENBQUMsRUFBRSxJQUNiLEVBQUU7QUFDQyxhQUFBLFNBQVMsQ0FBQyxPQUFPLEVBQUUsWUFBWSxDQUFDO0FBQ2hDLGFBQUEsU0FBUyxDQUFDLFlBQVksRUFBRSxZQUFZLENBQUM7YUFDckMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQztBQUN2QyxhQUFBLFFBQVEsQ0FBQyxPQUFNLEtBQUssS0FBRztZQUN0QixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1lBQ3RDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNmLFlBQUEsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ2xDLENBQUMsQ0FDTCxDQUFDO1FBRUosSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEtBQUssT0FBTyxFQUFFO1lBQzdDLElBQUlBLGdCQUFPLENBQUMsV0FBVyxDQUFDO0FBQ3JCLGlCQUFBLE9BQU8sQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDMUIsaUJBQUEsT0FBTyxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0FBQy9CLGlCQUFBLE9BQU8sQ0FBQyxJQUFJLElBQ1gsSUFBSTtBQUNELGlCQUFBLGNBQWMsQ0FBQyxDQUFDLENBQUMsMkJBQTJCLENBQUMsQ0FBQztpQkFDOUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQztBQUMzQyxpQkFBQSxRQUFRLENBQUMsT0FBTSxHQUFHLEtBQUc7Z0JBQ3BCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFlBQVksR0FBRyxHQUFHLENBQUM7QUFDeEMsZ0JBQUEsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO2FBQ2xDLENBQUMsQ0FDTCxDQUFDO1lBRUosSUFBSUEsZ0JBQU8sQ0FBQyxXQUFXLENBQUM7QUFDckIsaUJBQUEsT0FBTyxDQUFDLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0FBQ2pDLGlCQUFBLE9BQU8sQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDMUIsaUJBQUEsT0FBTyxDQUFDLElBQUksSUFDWCxJQUFJO0FBQ0QsaUJBQUEsY0FBYyxDQUFDLENBQUMsQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO2lCQUNyRCxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDO0FBQzNDLGlCQUFBLFFBQVEsQ0FBQyxPQUFNLEdBQUcsS0FBRztnQkFDcEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsWUFBWSxHQUFHLEdBQUcsQ0FBQztBQUN4QyxnQkFBQSxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7YUFDbEMsQ0FBQyxDQUNMLENBQUM7U0FDTDtRQUVELElBQUlBLGdCQUFPLENBQUMsV0FBVyxDQUFDO0FBQ3JCLGFBQUEsT0FBTyxDQUFDLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0FBQ2hDLGFBQUEsT0FBTyxDQUFDLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQ3JDLGFBQUEsU0FBUyxDQUFDLE1BQU0sSUFDZixNQUFNO2FBQ0gsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDO0FBQy9DLGFBQUEsUUFBUSxDQUFDLE9BQU0sS0FBSyxLQUFHO1lBQ3RCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGdCQUFnQixHQUFHLEtBQUssQ0FBQztZQUM5QyxJQUFJLEtBQUssRUFBRTtnQkFDVCxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDO2FBQzVDO1lBQ0QsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQ2YsWUFBQSxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7U0FDbEMsQ0FBQyxDQUNMLENBQUM7UUFFSixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFFBQVEsS0FBSyxZQUFZLEVBQUU7WUFDbEQsSUFBSUEsZ0JBQU8sQ0FBQyxXQUFXLENBQUM7QUFDckIsaUJBQUEsT0FBTyxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQzdCLGlCQUFBLE9BQU8sQ0FDTixDQUFDLENBQUMsbUVBQW1FLENBQUMsQ0FDdkU7QUFDQSxpQkFBQSxPQUFPLENBQUMsSUFBSSxJQUNYLElBQUk7aUJBQ0QsY0FBYyxDQUFDLEVBQUUsQ0FBQztpQkFDbEIsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQztBQUM1QyxpQkFBQSxRQUFRLENBQUMsT0FBTSxLQUFLLEtBQUc7Z0JBQ3RCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUM7QUFDM0MsZ0JBQUEsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO2FBQ2xDLENBQUMsQ0FDTCxDQUFDO0FBRUosWUFBQSxJQUFJLEVBQUUsS0FBSyxTQUFTLEVBQUU7Z0JBQ3BCLElBQUlBLGdCQUFPLENBQUMsV0FBVyxDQUFDO0FBQ3JCLHFCQUFBLE9BQU8sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDckIscUJBQUEsT0FBTyxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0FBQzVCLHFCQUFBLFNBQVMsQ0FBQyxNQUFNLElBQ2YsTUFBTTtxQkFDSCxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDO0FBQ3RDLHFCQUFBLFFBQVEsQ0FBQyxPQUFNLEtBQUssS0FBRztvQkFDdEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQztBQUNyQyxvQkFBQSxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7aUJBQ2xDLENBQUMsQ0FDTCxDQUFDO2FBQ0w7U0FDRjs7UUFHRCxJQUFJQSxnQkFBTyxDQUFDLFdBQVcsQ0FBQztBQUNyQixhQUFBLE9BQU8sQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDeEIsYUFBQSxPQUFPLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3hCLGFBQUEsV0FBVyxDQUFDLEVBQUUsSUFDYixFQUFFO2FBQ0MsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDakMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUM7YUFDbEMsU0FBUyxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQzthQUMvQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDO0FBQ3hDLGFBQUEsUUFBUSxDQUFDLE9BQU8sS0FBMEMsS0FBSTtZQUM3RCxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNmLFlBQUEsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ2xDLENBQUMsQ0FDTCxDQUFDO1FBRUosSUFBSUEsZ0JBQU8sQ0FBQyxXQUFXLENBQUM7QUFDckIsYUFBQSxPQUFPLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUM7QUFDL0IsYUFBQSxPQUFPLENBQUMsQ0FBQyxDQUFDLCtCQUErQixDQUFDLENBQUM7QUFDM0MsYUFBQSxPQUFPLENBQUMsSUFBSSxJQUNYLElBQUk7QUFDRCxhQUFBLGNBQWMsQ0FBQyxDQUFDLENBQUMsZ0NBQWdDLENBQUMsQ0FBQzthQUNuRCxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDO0FBQzlDLGFBQUEsUUFBUSxDQUFDLE9BQU0sR0FBRyxLQUFHO1lBQ3BCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGVBQWUsR0FBRyxHQUFHLENBQUM7QUFDM0MsWUFBQSxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7U0FDbEMsQ0FBQyxDQUNMLENBQUM7UUFFSixJQUFJQSxnQkFBTyxDQUFDLFdBQVcsQ0FBQztBQUNyQixhQUFBLE9BQU8sQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUM3QixhQUFBLE9BQU8sQ0FBQyxDQUFDLENBQUMsNkJBQTZCLENBQUMsQ0FBQztBQUN6QyxhQUFBLFNBQVMsQ0FBQyxNQUFNLElBQ2YsTUFBTTthQUNILFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUM7QUFDNUMsYUFBQSxRQUFRLENBQUMsT0FBTSxLQUFLLEtBQUc7WUFDdEIsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRTtBQUN6QyxnQkFBQSxJQUFJOUIsZUFBTSxDQUFDLCtDQUErQyxDQUFDLENBQUM7Z0JBQzVELElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUM7YUFDNUM7aUJBQU07Z0JBQ0wsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsYUFBYSxHQUFHLEtBQUssQ0FBQzthQUM1QztZQUNELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNmLFlBQUEsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ2xDLENBQUMsQ0FDTCxDQUFDO1FBRUosSUFBSThCLGdCQUFPLENBQUMsV0FBVyxDQUFDO0FBQ3JCLGFBQUEsT0FBTyxDQUFDLENBQUMsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0FBQ3ZDLGFBQUEsT0FBTyxDQUFDLENBQUMsQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO0FBQ25ELGFBQUEsV0FBVyxDQUFDLFFBQVEsSUFDbkIsUUFBUTthQUNMLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQztBQUNsRCxhQUFBLFFBQVEsQ0FBQyxPQUFNLEtBQUssS0FBRztZQUN0QixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsR0FBRyxLQUFLLENBQUM7QUFDakQsWUFBQSxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7U0FDbEMsQ0FBQyxDQUNMLENBQUM7UUFFSixJQUFJQSxnQkFBTyxDQUFDLFdBQVcsQ0FBQztBQUNyQixhQUFBLE9BQU8sQ0FBQyxDQUFDLENBQUMsbURBQW1ELENBQUMsQ0FBQztBQUMvRCxhQUFBLE9BQU8sQ0FDTixDQUFDLENBQ0MscUdBQXFHLENBQ3RHLENBQ0Y7QUFDQSxhQUFBLFNBQVMsQ0FBQyxNQUFNLElBQ2YsTUFBTTthQUNILFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7QUFDekMsYUFBQSxRQUFRLENBQUMsT0FBTSxLQUFLLEtBQUc7WUFDdEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztZQUN4QyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDZixZQUFBLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztTQUNsQyxDQUFDLENBQ0wsQ0FBQztRQUVKLElBQUlBLGdCQUFPLENBQUMsV0FBVyxDQUFDO0FBQ3JCLGFBQUEsT0FBTyxDQUFDLENBQUMsQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO0FBQ3RELGFBQUEsT0FBTyxDQUFDLENBQUMsQ0FBQyx3REFBd0QsQ0FBQyxDQUFDO0FBQ3BFLGFBQUEsU0FBUyxDQUFDLE1BQU0sSUFDZixNQUFNO2FBQ0gsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQztBQUMzQyxhQUFBLFFBQVEsQ0FBQyxPQUFNLEtBQUssS0FBRztZQUN0QixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDO1lBQzFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNmLFlBQUEsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ2xDLENBQUMsQ0FDTCxDQUFDO1FBRUosSUFBSUEsZ0JBQU8sQ0FBQyxXQUFXLENBQUM7YUFDckIsT0FBTyxDQUFDLFdBQVcsQ0FBQzthQUNwQixPQUFPLENBQUMseUNBQXlDLENBQUM7QUFDbEQsYUFBQSxTQUFTLENBQUMsTUFBTSxJQUNmLE1BQU0sQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVc7QUFDOUMsWUFBQSxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztBQUNsRCxTQUFDLENBQUMsQ0FDSDtBQUNBLGFBQUEsU0FBUyxDQUFDLE1BQU0sSUFDZixNQUFNO2FBQ0gsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQztBQUM5QyxhQUFBLFFBQVEsQ0FBQyxPQUFNLEtBQUssS0FBRztZQUN0QixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxlQUFlLEdBQUcsS0FBSyxDQUFDO0FBQzdDLFlBQUEsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ2xDLENBQUMsQ0FDTCxDQUFDO0FBRUosUUFBQSxJQUFJLENBQUMsMEJBQTBCLENBQUMsV0FBVyxDQUFDLENBQUM7S0FDOUM7QUFFTyxJQUFBLDBCQUEwQixDQUFDLFdBQXdCLEVBQUE7UUFDekQsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUM3QyxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSx5QkFBeUIsRUFBRSxDQUFDLENBQUM7UUFDaEUsV0FBVyxDQUFDLFNBQVMsQ0FBQztBQUNwQixZQUFBLEdBQUcsRUFBRSxnQ0FBZ0M7WUFDckMsSUFBSSxFQUFFLFFBQVEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFFLENBQUE7QUFDN0MsU0FBQSxDQUFDLENBQUM7QUFFSCxRQUFBLE1BQU0sUUFBUSxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsRUFBRSxHQUFHLEVBQUUsK0JBQStCLEVBQUUsQ0FBQyxDQUFDO0FBQ2pGLFFBQUEsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUU7QUFDOUMsWUFBQSxHQUFHLEVBQUUsMENBQTBDO1lBQy9DLElBQUksRUFBRSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsUUFBUSxHQUFHLE1BQU07QUFDaEQsU0FBQSxDQUFDLENBQUM7UUFDSCxXQUFXLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDO0FBQ2hFLFFBQUEsV0FBVyxDQUFDLE9BQU8sR0FBRyxZQUFXO0FBQy9CLFlBQUEsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQztBQUM3QixZQUFBLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxFQUFFLENBQUM7QUFDOUIsWUFBQSxJQUFJLENBQUMsYUFBYSxHQUFHLEVBQUUsQ0FBQztZQUN4QixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFFZixNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFLENBQUM7QUFDbEQsWUFBQSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDO0FBRTlCLFlBQUEsSUFBSSxNQUFNLENBQUMsS0FBSyxLQUFLLFdBQVcsRUFBRTtBQUNoQyxnQkFBQSxJQUFJOUIsZUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQzVCLGdCQUFBLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxlQUFlLENBQUM7YUFDNUM7QUFBTSxpQkFBQSxJQUFJLE1BQU0sQ0FBQyxLQUFLLEVBQUU7QUFDdkIsZ0JBQUEsSUFBSUEsZUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN6QixnQkFBQSxJQUFJLENBQUMsbUJBQW1CLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQzthQUN6QztBQUFNLGlCQUFBLElBQUksTUFBTSxDQUFDLFNBQVMsRUFBRTtBQUMzQixnQkFBQSxJQUFJLENBQUMsYUFBYSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUM7QUFDcEMsZ0JBQUEsSUFBSSxDQUFDLG1CQUFtQixHQUFHLENBQVksU0FBQSxFQUFBLE1BQU0sQ0FBQyxPQUFPLENBQUEsSUFBQSxFQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sR0FBRyxDQUFDO2FBQzdGO2lCQUFNO0FBQ0wsZ0JBQUEsSUFBSSxDQUFDLG1CQUFtQixHQUFHLENBQUEsV0FBQSxFQUFjLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQSxDQUFBLENBQUcsQ0FBQzthQUMxRTtZQUNELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNqQixTQUFDLENBQUM7QUFFRixRQUFBLElBQUksSUFBSSxDQUFDLG1CQUFtQixFQUFFO0FBQzVCLFlBQUEsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsRUFBRSwrQkFBK0IsRUFBRSxDQUFDLENBQUM7WUFDakYsUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxDQUFDO0FBRXZELFlBQUEsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFO0FBQ3RCLGdCQUFBLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFO0FBQy9DLG9CQUFBLEdBQUcsRUFBRSwyQ0FBMkM7QUFDaEQsb0JBQUEsSUFBSSxFQUFFLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBVSxPQUFBLEVBQUEsSUFBSSxDQUFDLGNBQWMsQ0FBQSxHQUFBLENBQUssR0FBRyxNQUFNO0FBQ3BFLGlCQUFBLENBQUMsQ0FBQztBQUNILGdCQUFBLFlBQVksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztBQUN4QyxnQkFBQSxZQUFZLENBQUMsT0FBTyxHQUFHLFlBQVc7QUFDaEMsb0JBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7QUFDdkIsb0JBQUEsSUFBSSxDQUFDLGNBQWMsR0FBRyxDQUFDLENBQUM7b0JBQ3hCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUVmLG9CQUFBLElBQUk7QUFDRix3QkFBQSxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxLQUFJO0FBQ2xFLDRCQUFBLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDOzRCQUMzQixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDakIseUJBQUMsQ0FBQyxDQUFDO0FBQ0gsd0JBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7QUFDeEIsd0JBQUEsSUFBSSxDQUFDLGFBQWEsR0FBRyxFQUFFLENBQUM7QUFDeEIsd0JBQUEsSUFBSSxDQUFDLG1CQUFtQixHQUFHLEVBQUUsQ0FBQztxQkFDL0I7b0JBQUMsT0FBTyxLQUFLLEVBQUU7QUFDZCx3QkFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztBQUN4Qix3QkFBQSxJQUFJQSxlQUFNLENBQUMsQ0FBQSxLQUFBLEVBQVEsS0FBSyxDQUFBLENBQUUsQ0FBQyxDQUFDO0FBQzVCLHdCQUFBLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxDQUFRLEtBQUEsRUFBQSxLQUFLLEVBQUUsQ0FBQztxQkFDNUM7b0JBQ0QsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQ2pCLGlCQUFDLENBQUM7YUFDSDtTQUNGO0FBRUQsUUFBQSxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLHFDQUFxQyxFQUFFLENBQUMsQ0FBQztRQUN6RixJQUFJOEIsZ0JBQU8sQ0FBQyxXQUFXLENBQUM7YUFDckIsT0FBTyxDQUFDLFFBQVEsQ0FBQzthQUNqQixPQUFPLENBQUMsc0JBQXNCLENBQUM7QUFDL0IsYUFBQSxTQUFTLENBQUMsTUFBTSxJQUNmLE1BQU07YUFDSCxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDO0FBQ3pDLGFBQUEsUUFBUSxDQUFDLE9BQU0sS0FBSyxLQUFHO1lBQ3RCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7QUFDeEMsWUFBQSxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxFQUFFLENBQUM7U0FDbEMsQ0FBQyxDQUNMLENBQUM7S0FDTDtBQUNGOztBQ3ZVRCxNQUFNLGVBQWUsR0FBRyw2RkFBNkYsQ0FBQztBQWdCakcsTUFBQSxxQkFBc0IsU0FBUUMsZUFBTSxDQUFBO0FBQ3ZELElBQUEsUUFBUSxDQUFpQjtBQUN6QixJQUFBLE1BQU0sQ0FBUztBQUNmLElBQUEsTUFBTSxDQUFTO0FBQ2YsSUFBQSxhQUFhLENBQWdCO0FBQzdCLElBQUEsWUFBWSxDQUFlO0FBQzNCLElBQUEsaUJBQWlCLENBQW9CO0FBQ3JDLElBQUEsUUFBUSxDQUFvQztJQUNwQyxvQkFBb0IsR0FBa0IsSUFBSSxDQUFDO0lBQzNDLHNCQUFzQixHQUFrQixJQUFJLENBQUM7SUFDN0Msd0JBQXdCLEdBQUcsRUFBRSxDQUFDO0FBRXRDLElBQUEsTUFBTSxZQUFZLEdBQUE7QUFDaEIsUUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsTUFBTSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztLQUN4RTtBQUVELElBQUEsTUFBTSxZQUFZLEdBQUE7UUFDaEIsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztLQUNwQztJQUVELFFBQVEsR0FBQTtRQUNOLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO1FBQ2pDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO0tBQ3BDO0FBRUQsSUFBQSxNQUFNLE1BQU0sR0FBQTtBQUNWLFFBQUEsTUFBTSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFFMUIsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDbkMsUUFBQSxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDNUQsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMzQyxRQUFBLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLGlCQUFpQixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFcEUsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsS0FBSyxPQUFPLEVBQUU7QUFDdEMsWUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUM7U0FDcEM7YUFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxLQUFLLFlBQVksRUFBRTtBQUNsRCxZQUFBLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDO0FBQ3ZDLFlBQUEsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRTtBQUN6QixnQkFBQSxPQUFPLEVBQUUsQ0FBQzthQUNYO1NBQ0Y7YUFBTTtBQUNMLFlBQUEsSUFBSS9CLGVBQU0sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1NBQ2hDO1FBRURnQyxnQkFBTyxDQUNMLFFBQVEsRUFDUixDQUFBOztBQUVLLFVBQUEsQ0FBQSxDQUNOLENBQUM7QUFFRixRQUFBLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRW5ELElBQUksQ0FBQyxVQUFVLENBQUM7QUFDZCxZQUFBLEVBQUUsRUFBRSxtQkFBbUI7QUFDdkIsWUFBQSxJQUFJLEVBQUUsbUJBQW1CO0FBQ3pCLFlBQUEsYUFBYSxFQUFFLENBQUMsUUFBaUIsS0FBSTtnQkFDbkMsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDO2dCQUN6QyxJQUFJLElBQUksRUFBRTtvQkFDUixJQUFJLENBQUMsUUFBUSxFQUFFO3dCQUNiLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztxQkFDdEI7QUFDRCxvQkFBQSxPQUFPLElBQUksQ0FBQztpQkFDYjtBQUNELGdCQUFBLE9BQU8sS0FBSyxDQUFDO2FBQ2Q7QUFDRixTQUFBLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxVQUFVLENBQUM7QUFDZCxZQUFBLEVBQUUsRUFBRSxxQkFBcUI7QUFDekIsWUFBQSxJQUFJLEVBQUUscUJBQXFCO0FBQzNCLFlBQUEsYUFBYSxFQUFFLENBQUMsUUFBaUIsS0FBSTtnQkFDbkMsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDO2dCQUN6QyxJQUFJLElBQUksRUFBRTtvQkFDUixJQUFJLENBQUMsUUFBUSxFQUFFO3dCQUNiLHFCQUFxQixDQUFDLElBQUksQ0FBQyxDQUFDO3FCQUM3QjtBQUNELG9CQUFBLE9BQU8sSUFBSSxDQUFDO2lCQUNiO0FBQ0QsZ0JBQUEsT0FBTyxLQUFLLENBQUM7YUFDZDtBQUNGLFNBQUEsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDekIsSUFBSSxDQUFDLGtDQUFrQyxDQUFDLGNBQWMsRUFBRSxDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsR0FBRyxLQUN0RSxpQkFBaUIsQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FDeEMsQ0FBQztBQUNGLFFBQUEsSUFBSSxDQUFDLDZCQUE2QixDQUFDLEVBQUUsSUFBRztBQUN0QyxZQUFBLHlCQUF5QixDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDMUMsU0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsdUJBQXVCLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDN0QsUUFBQSxJQUFJLENBQUMsYUFBYSxDQUNoQixJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsb0JBQW9CLEVBQUUsTUFBSztBQUMvQyxZQUFBLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBSztBQUNyQixnQkFBQSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQ0oscUJBQVksQ0FBQyxDQUFDO2dCQUN4RSxJQUFJLENBQUMsVUFBVSxFQUFFO29CQUNmLE9BQU87aUJBQ1I7Z0JBQ0QseUJBQXlCLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7YUFDN0QsRUFBRSxHQUFHLENBQUMsQ0FBQztTQUNULENBQUMsQ0FDSCxDQUFDO1FBQ0YsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDeEIsSUFBSSxDQUFDLGdCQUFnQixDQUNuQixNQUFNLENBQUMsV0FBVyxDQUFDLE1BQUs7QUFDdEIsWUFBQSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxFQUFFO2dCQUNqQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxJQUFHO0FBQ3JDLG9CQUFBLE9BQU8sQ0FBQyxLQUFLLENBQUMsbUNBQW1DLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDNUQsaUJBQUMsQ0FBQyxDQUFDO2FBQ0o7U0FDRixFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQ25CLENBQUM7UUFFRixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztLQUNoQztJQUVELGlCQUFpQixHQUFBO1FBQ2YsSUFBSSxDQUFDLGFBQWEsQ0FDaEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUNuQixhQUFhLEVBQ2IsQ0FBQyxJQUFVLEVBQUUsTUFBYyxFQUFFLElBQXFDLEtBQUk7QUFDcEUsWUFBQSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO2dCQUMvRCxPQUFPO2FBQ1I7QUFDRCxZQUFBLE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUN4QyxJQUFJLFNBQVMsRUFBRTtnQkFDYixNQUFNLGFBQWEsR0FBRyxrQkFBa0IsQ0FBQztnQkFDekMsTUFBTSxhQUFhLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDcEQsSUFBSSxhQUFhLElBQUksYUFBYSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDN0Msb0JBQUEsTUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNyQyxJQUNFLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLElBQUksQ0FDL0IsQ0FBQyxJQUF3QixLQUFLLElBQUksQ0FBQyxNQUFNLEtBQUssV0FBVyxDQUMxRCxFQUNEO3dCQUNBLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQztxQkFDekM7aUJBQ0Y7YUFDRjtTQUNGLENBQ0YsQ0FDRixDQUFDO0tBQ0g7SUFFRCxPQUFPLEdBQUcsQ0FBQyxJQUFVLEVBQUUsT0FBZSxFQUFFLE1BQWMsS0FBSTtRQUN4RCxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBYyxLQUMxQixJQUFJO2FBQ0QsT0FBTyxDQUFDLFNBQVMsQ0FBQztBQUNsQixhQUFBLFFBQVEsQ0FBQyxDQUFDLENBQUMsNEJBQTRCLENBQUMsQ0FBQzthQUN6QyxPQUFPLENBQUMsWUFBVztBQUNsQixZQUFBLElBQUk7Z0JBQ0YsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUNwRCxDQUFDLElBQXdCLEtBQUssSUFBSSxDQUFDLE1BQU0sS0FBSyxPQUFPLENBQ3RELENBQUM7Z0JBQ0YsSUFBSSxZQUFZLEVBQUU7QUFDaEIsb0JBQUEsTUFBTSxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7QUFDaEUsb0JBQUEsSUFBSSxHQUFHLENBQUMsT0FBTyxFQUFFO0FBQ2Ysd0JBQUEsSUFBSTVCLGVBQU0sQ0FBQyxDQUFDLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDO0FBQ3JDLHdCQUFBLE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQzt3QkFDeEMsSUFBSSxTQUFTLEVBQUU7QUFDYiw0QkFBQSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLENBQUM7eUJBQzdCO3dCQUNELElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYztBQUMxQiw0QkFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQ2pDLENBQUMsSUFBd0IsS0FBSyxJQUFJLENBQUMsTUFBTSxLQUFLLE9BQU8sQ0FDdEQsQ0FBQzt3QkFDSixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7cUJBQ3JCO3lCQUFNO0FBQ0wsd0JBQUEsSUFBSUEsZUFBTSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDO3FCQUNoQztpQkFDRjthQUNGO0FBQUMsWUFBQSxNQUFNO0FBQ04sZ0JBQUEsSUFBSUEsZUFBTSxDQUFDLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUM7YUFDMUM7U0FDRixDQUFDLENBQ0wsQ0FBQztBQUNKLEtBQUMsQ0FBQztJQUVGLGdCQUFnQixHQUFBO1FBQ2QsSUFBSSxDQUFDLGFBQWEsQ0FDaEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUNuQixXQUFXLEVBQ1gsQ0FBQyxJQUFVLEVBQUUsSUFBVyxFQUFFLE1BQWMsRUFBRSxJQUFJLEtBQUk7WUFDaEQsSUFBSSxNQUFNLEtBQUssYUFBYTtBQUFFLGdCQUFBLE9BQU8sS0FBSyxDQUFDO0FBQzNDLFlBQUEsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7QUFBRSxnQkFBQSxPQUFPLEtBQUssQ0FBQztBQUVqRCxZQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFjLEtBQUk7Z0JBQzlCLElBQUk7cUJBQ0QsUUFBUSxDQUFDLFFBQVEsQ0FBQztxQkFDbEIsT0FBTyxDQUFDLFFBQVEsQ0FBQztxQkFDakIsT0FBTyxDQUFDLE1BQUs7QUFDWixvQkFBQSxJQUFJLEVBQUUsSUFBSSxZQUFZaUMsY0FBSyxDQUFDLEVBQUU7QUFDNUIsd0JBQUEsT0FBTyxLQUFLLENBQUM7cUJBQ2Q7QUFDRCxvQkFBQSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzVCLGlCQUFDLENBQUMsQ0FBQztBQUNQLGFBQUMsQ0FBQyxDQUFDO1NBQ0osQ0FDRixDQUNGLENBQUM7S0FDSDtBQUVELElBQUEsY0FBYyxDQUFDLElBQVcsRUFBQTtRQUN4QixJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBRXJDLFFBQUEsTUFBTSxRQUFRLEdBQ1osSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FDaEIsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNoQixJQUFJLFNBQVMsR0FBWSxFQUFFLENBQUM7UUFDNUIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUU1QyxRQUFBLEtBQUssTUFBTSxLQUFLLElBQUksU0FBUyxFQUFFO0FBQzdCLFlBQUEsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztBQUM3QixZQUFBLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFFOUIsTUFBTSxRQUFRLEdBQUdDLHVCQUFRLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFFakQsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7Z0JBQ2xDLE1BQU0saUJBQWlCLEdBQUdULG1CQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUVwRCxnQkFBQSxJQUFJLGtCQUFrQixDQUFDLGlCQUFpQixDQUFDLEVBQUU7b0JBQ3pDLFNBQVMsQ0FBQyxJQUFJLENBQUM7QUFDYix3QkFBQSxJQUFJLEVBQUUsaUJBQWlCO0FBQ3ZCLHdCQUFBLElBQUksRUFBRSxTQUFTO3dCQUNmLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTTtBQUNyQixxQkFBQSxDQUFDLENBQUM7aUJBQ0o7YUFDRjtTQUNGO0FBRUQsUUFBQSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQzFCLFlBQUEsSUFBSXpCLGVBQU0sQ0FBQyxDQUFDLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDO1lBQ3pDLE9BQU87U0FDUjtRQUVELElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUc7QUFDckUsWUFBQSxJQUFJLEdBQUcsQ0FBQyxPQUFPLEVBQUU7QUFDZixnQkFBQSxJQUFJLGFBQWEsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO0FBQy9CLGdCQUFBLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFHO0FBQ25CLG9CQUFBLE1BQU0sV0FBVyxHQUFHLGFBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztvQkFDMUMsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBRXRDLE9BQU8sR0FBRyxPQUFPLENBQUMsVUFBVSxDQUMxQixJQUFJLENBQUMsTUFBTSxFQUNYLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUMvQyxDQUFDO0FBQ0osaUJBQUMsQ0FBQyxDQUFDO0FBQ0gsZ0JBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUM7QUFFOUIsZ0JBQUEsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksRUFBRTtBQUM5QixvQkFBQSxTQUFTLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBRzt3QkFDcEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxFQUFFOzRCQUNsQ21DLGlCQUFNLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFLLEdBQUcsQ0FBQyxDQUFDO3lCQUM5QjtBQUNILHFCQUFDLENBQUMsQ0FBQztpQkFDSjthQUNGO2lCQUFNO0FBQ0wsZ0JBQUEsSUFBSW5DLGVBQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQzthQUM1QjtBQUNILFNBQUMsQ0FBQyxDQUFDO0tBQ0o7QUFFRCxJQUFBLFVBQVUsQ0FBQyxTQUFrQixFQUFBO1FBQzNCLE1BQU0sU0FBUyxHQUFZLEVBQUUsQ0FBQztBQUU5QixRQUFBLEtBQUssTUFBTSxLQUFLLElBQUksU0FBUyxFQUFFO1lBQzdCLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUU7QUFDakMsZ0JBQUEsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRTtBQUMvQixvQkFBQSxJQUNFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQ3pCLEtBQUssQ0FBQyxJQUFJLEVBQ1YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FDbEMsRUFDRDt3QkFDQSxTQUFTLENBQUMsSUFBSSxDQUFDOzRCQUNiLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTs0QkFDaEIsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJOzRCQUNoQixNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU07QUFDckIseUJBQUEsQ0FBQyxDQUFDO3FCQUNKO2lCQUNGO2FBQ0Y7aUJBQU07Z0JBQ0wsU0FBUyxDQUFDLElBQUksQ0FBQztvQkFDYixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7b0JBQ2hCLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTtvQkFDaEIsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNO0FBQ3JCLGlCQUFBLENBQUMsQ0FBQzthQUNKO1NBQ0Y7QUFFRCxRQUFBLE9BQU8sU0FBUyxDQUFDO0tBQ2xCO0lBQ0QsT0FBTyxDQUFDLFFBQWdCLEVBQUUsT0FBWSxFQUFBO1FBQ3BDLElBQUksQ0FBQyxPQUFPLEVBQUU7QUFDWixZQUFBLE9BQU8sR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7U0FDNUQ7QUFDRCxRQUFBLE9BQU8sT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0tBQzFCO0FBRUQsSUFBQSxNQUFNLGlCQUFpQixHQUFBO0FBQ3JCLFFBQUEsTUFBTSxNQUFNLEdBQTRCO0FBQ3RDLFlBQUEsT0FBTyxFQUFFLENBQUM7QUFDVixZQUFBLFFBQVEsRUFBRSxDQUFDO0FBQ1gsWUFBQSxRQUFRLEVBQUUsQ0FBQztBQUNYLFlBQUEsT0FBTyxFQUFFLENBQUM7QUFDVixZQUFBLE1BQU0sRUFBRSxFQUFFO1NBQ1gsQ0FBQztBQUNGLFFBQUEsTUFBTSxRQUFRLEdBQ1osSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FDaEIsQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUNoQixRQUFBLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSztBQUM5QixhQUFBLFFBQVEsRUFBRTthQUNWLE1BQU0sQ0FDTCxJQUFJLElBQ0YsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSTtBQUN2QixhQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQzNELENBQUM7QUFDSixRQUFBLE1BQU0sQ0FBQyxPQUFPLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQztBQUVuQyxRQUFBLEtBQUssTUFBTSxJQUFJLElBQUksVUFBVSxFQUFFO0FBQzdCLFlBQUEsSUFBSTtBQUNGLGdCQUFBLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDekIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMxRCxvQkFBQSxNQUFNLFdBQVcsR0FBRyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDcEQsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsaUNBQWlDLENBQzNELElBQUksRUFDSixXQUFXLENBQ1osQ0FBQztBQUVGLG9CQUFBLElBQUksUUFBUSxLQUFLLENBQUMsRUFBRTt3QkFDbEIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBRyxFQUFBLElBQUksQ0FBQyxJQUFJLENBQXVCLHFCQUFBLENBQUEsQ0FBQyxDQUFDO3dCQUN4RCxTQUFTO3FCQUNWO0FBRUQsb0JBQUEsTUFBTSxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztBQUNwQyxvQkFBQSxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQztBQUMzRCxvQkFBQSxNQUFNLENBQUMsUUFBUSxJQUFJLFFBQVEsQ0FBQztvQkFDNUIsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUNqQixTQUFTO2lCQUNWO2dCQUVELE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUM7QUFDbkQsb0JBQUF5QixtQkFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQzFCLGlCQUFBLENBQUMsQ0FBQztnQkFFSCxJQUNFLENBQUMsWUFBWSxDQUFDLE9BQU87b0JBQ3JCLENBQUMsWUFBWSxDQUFDLE1BQU07QUFDcEIsb0JBQUEsWUFBWSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUNoQztvQkFDQSxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFHLEVBQUEsSUFBSSxDQUFDLElBQUksQ0FBQSxPQUFBLEVBQVUsWUFBWSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUEsQ0FBRSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7b0JBQzFFLFNBQVM7aUJBQ1Y7Z0JBRUQsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBQ2xCLGdCQUFBLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVELGdCQUFBLE9BQU8sQ0FBQyxHQUFHLENBQUMsd0NBQXdDLEVBQUUsU0FBUyxDQUFDLENBQUM7Z0JBRWpFLElBQUksQ0FBQyxTQUFTLEVBQUU7b0JBQ2QsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBRyxFQUFBLElBQUksQ0FBQyxJQUFJLENBQW1CLGlCQUFBLENBQUEsQ0FBQyxDQUFDO29CQUNwRCxTQUFTO2lCQUNWO2dCQUVELE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQztBQUVuRSxnQkFBQSxJQUFJLFFBQVEsS0FBSyxDQUFDLEVBQUU7b0JBQ2xCLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUcsRUFBQSxJQUFJLENBQUMsSUFBSSxDQUE4Qiw0QkFBQSxDQUFBLENBQUMsQ0FBQztvQkFDL0QsU0FBUztpQkFDVjtBQUVELGdCQUFBLE1BQU0sQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDO2dCQUM1QixNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbEMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO2FBQ2xCO1lBQUMsT0FBTyxLQUFLLEVBQUU7QUFDZCxnQkFBQSxNQUFNLE1BQU0sR0FBRyxLQUFLLFlBQVksS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3RFLGdCQUFBLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUEsRUFBRyxJQUFJLENBQUMsSUFBSSxDQUFBLEVBQUEsRUFBSyxNQUFNLENBQUEsQ0FBRSxDQUFDLENBQUM7YUFDL0M7U0FDRjtBQUVELFFBQUEsT0FBTyxNQUFNLENBQUM7S0FDZjtBQUVELElBQUEsTUFBTSwyQkFBMkIsR0FBQTtBQUMvQixRQUFBLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7QUFFOUMsUUFBQSxJQUFJLE1BQU0sQ0FBQyxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQ3hCLFlBQUEsSUFBSXpCLGVBQU0sQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO1lBQ3ZDLE9BQU87U0FDUjtBQUVELFFBQUEsTUFBTSxPQUFPLEdBQUcsQ0FBQSxXQUFBLEVBQWMsTUFBTSxDQUFDLE9BQU8sU0FBUyxNQUFNLENBQUMsUUFBUSxDQUFTLE1BQUEsRUFBQSxNQUFNLENBQUMsUUFBUSxDQUFBLE1BQUEsRUFBUyxNQUFNLENBQUMsT0FBTyxLQUFLLENBQUM7UUFFekgsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDOUIsWUFBQSxJQUFJQSxlQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDcEIsT0FBTztTQUNSO1FBRUQsSUFBSUEsZUFBTSxDQUFDLENBQUcsRUFBQSxPQUFPLFNBQVMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBRSxDQUFBLENBQUMsQ0FBQztLQUN0RTtBQUVELElBQUEsWUFBWSxDQUFDLE1BQVcsRUFBQTtBQUN0QixRQUFBLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFO0FBQzlCLFlBQUEsT0FBTyxNQUFNLENBQUM7U0FDZjtBQUVELFFBQUEsSUFBSSxNQUFNLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFO0FBQ3hDLFlBQUEsT0FBTyxNQUFNLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUM7U0FDekQ7QUFFRCxRQUFBLE9BQU8sRUFBRSxDQUFDO0tBQ1g7QUFFRCxJQUFBLE1BQU0scUJBQXFCLENBQUMsSUFBVyxFQUFFLEdBQVcsRUFBQTtRQUNsRCxJQUFJLFFBQVEsR0FBRyxDQUFDLENBQUM7QUFFakIsUUFBQSxLQUFLLE1BQU0sUUFBUSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEVBQUU7QUFDN0UsWUFBQSxNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNwRCxZQUFBLE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxTQUFTLEtBQUssUUFBUTtrQkFDMUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDO2tCQUNoRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztBQUUvQyxZQUFBLElBQUksTUFBTSxDQUFDLE9BQU8sS0FBSyxPQUFPLEVBQUU7QUFDOUIsZ0JBQUEsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUN0RCxnQkFBQSxRQUFRLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQzthQUM3QjtTQUNGO0FBRUQsUUFBQSxPQUFPLFFBQVEsQ0FBQztLQUNqQjtBQUVELElBQUEsZUFBZSxDQUFDLElBQVcsRUFBQTtBQUN6QixRQUFBLE9BQU8sQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7S0FDMUQ7SUFFRCxlQUFlLENBQUMsTUFBYyxFQUFFLElBQVcsRUFBQTtBQUN6QyxRQUFBLElBQUksSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUV6QixRQUFBLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQzlDLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQzFCO0FBQ0QsUUFBQSxJQUNFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQztBQUMzQyxhQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUM1QztZQUNBLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQzFCO0FBRUQsUUFBQSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFFeEMsUUFBQSxJQUFJO0FBQ0YsWUFBQSxJQUFJLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ3hCO0FBQUMsUUFBQSxNQUFNO0FBQ04sWUFBQSxPQUFPLEtBQUssQ0FBQztTQUNkO0FBRUQsUUFBQSxJQUFJLHNCQUFzQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUNyQyxZQUFBLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7QUFFRCxRQUFBLE1BQU0sY0FBYyxHQUFHc0Isc0JBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUUzQyxRQUFBLE9BQU8sY0FBYyxLQUFLLElBQUksQ0FBQyxJQUFJLElBQUlZLHVCQUFRLENBQUMsY0FBYyxDQUFDLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQztLQUMvRTtBQUVELElBQUEsdUJBQXVCLENBQUMsT0FBZSxFQUFFLElBQVcsRUFBRSxHQUFXLEVBQUE7QUFDL0QsUUFBQSxJQUFJLElBQUksQ0FBQztBQUVULFFBQUEsSUFBSTtBQUNGLFlBQUEsSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7U0FDNUI7QUFBQyxRQUFBLE1BQU07WUFDTixPQUFPO2dCQUNMLE9BQU87QUFDUCxnQkFBQSxRQUFRLEVBQUUsQ0FBQzthQUNaLENBQUM7U0FDSDtRQUVELElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUM5QixPQUFPO2dCQUNMLE9BQU87QUFDUCxnQkFBQSxRQUFRLEVBQUUsQ0FBQzthQUNaLENBQUM7U0FDSDtRQUVELElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQztRQUVqQixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQVMsS0FBSTtBQUMvQixZQUFBLElBQ0UsSUFBSTtnQkFDSixJQUFJLENBQUMsSUFBSSxLQUFLLE1BQU07QUFDcEIsZ0JBQUEsT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVE7Z0JBQzdCLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsRUFDckM7QUFDQSxnQkFBQSxJQUFJLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQztBQUNuQixnQkFBQSxJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztnQkFDZixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDakIsZ0JBQUEsUUFBUSxFQUFFLENBQUM7YUFDWjtBQUNILFNBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTztZQUNMLE9BQU8sRUFBRSxRQUFRLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxPQUFPO1lBQ2xFLFFBQVE7U0FDVCxDQUFDO0tBQ0g7QUFFRCxJQUFBLGlCQUFpQixDQUFDLE9BQWUsRUFBRSxJQUFXLEVBQUUsR0FBVyxFQUFBO0FBQ3pELFFBQUEsTUFBTSxZQUFZLEdBQUcsQ0FBQyxLQUFhLEtBQUk7WUFDckMsT0FBTyxLQUFLLENBQUMsT0FBTyxDQUFDLHFCQUFxQixFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ3RELFNBQUMsQ0FBQztRQUVGLE1BQU0sYUFBYSxHQUFHLG9CQUFvQixDQUFDO1FBQzNDLE1BQU0sa0JBQWtCLEdBQUcsMkJBQTJCLENBQUM7UUFDdkQsSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDO1FBQ2pCLE1BQU0sWUFBWSxHQUFhLEVBQUUsQ0FBQztRQUVsQyxNQUFNLFVBQVUsR0FBRyxPQUFPO2FBQ3ZCLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxLQUFJO1lBQ3pDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEMsWUFBQSxNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUM7WUFFOUMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFO0FBQ3JDLGdCQUFBLE9BQU8sTUFBTSxDQUFDO2FBQ2Y7QUFFRCxZQUFBLFFBQVEsRUFBRSxDQUFDO0FBQ1gsWUFBQSxZQUFZLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDekQsWUFBQSxPQUFPLG9CQUFvQixZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsUUFBUSxDQUFDO0FBQzdELFNBQUMsQ0FBQzthQUNELE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsTUFBTSxLQUFJO1lBQ25ELElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsRUFBRTtBQUN2QyxnQkFBQSxPQUFPLE1BQU0sQ0FBQzthQUNmO0FBRUQsWUFBQSxRQUFRLEVBQUUsQ0FBQztBQUNYLFlBQUEsWUFBWSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3pELFlBQUEsT0FBTyxvQkFBb0IsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLFFBQVEsQ0FBQztBQUM3RCxTQUFDLENBQUM7YUFDRCxPQUFPLENBQUMsSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsV0FBVyxLQUFJO1lBQ2pGLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDbEMsZ0JBQUEsT0FBTyxNQUFNLENBQUM7YUFDZjtBQUVELFlBQUEsTUFBTSxNQUFNLEdBQUcsTUFBTSxHQUFHLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUN6RCxZQUFBLE1BQU0sS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUV4RCxZQUFBLElBQUksMkJBQTJCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFO0FBQzVDLGdCQUFBLE9BQU8sTUFBTSxDQUFDO2FBQ2Y7QUFDRCxZQUFBLElBQUksNkJBQTZCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQzdDLGdCQUFBLE9BQU8sTUFBTSxDQUFDO2FBQ2Y7QUFFRCxZQUFBLFFBQVEsRUFBRSxDQUFDO1lBQ1gsT0FBTyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzFDLFNBQUMsQ0FBQzthQUNELE9BQU8sQ0FBQywrQkFBK0IsRUFBRSxDQUFDLE1BQU0sRUFBRSxLQUFLLEtBQUk7WUFDMUQsT0FBTyxZQUFZLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDO0FBQy9DLFNBQUMsQ0FBQyxDQUFDO1FBRUwsT0FBTztBQUNMLFlBQUEsT0FBTyxFQUFFLFVBQVU7WUFDbkIsUUFBUTtTQUNULENBQUM7S0FDSDtBQUVPLElBQUEscUJBQXFCLENBQzNCLE9BQWUsRUFDZixJQUFXLEVBQ1gsV0FBbUIsRUFBQTtRQUVuQixNQUFNLGFBQWEsR0FBRyxvQkFBb0IsQ0FBQztRQUMzQyxNQUFNLGlCQUFpQixHQUFHLDJCQUEyQixDQUFDO1FBQ3RELElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQztRQUNqQixNQUFNLFlBQVksR0FBYSxFQUFFLENBQUM7UUFFbEMsTUFBTSxVQUFVLEdBQUcsT0FBTzthQUN2QixPQUFPLENBQUMsYUFBYSxFQUFFLENBQUMsS0FBSyxFQUFFLE1BQU0sS0FBSTtZQUN4QyxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRWxDLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRTtBQUNyQyxnQkFBQSxPQUFPLEtBQUssQ0FBQzthQUNkO0FBRUQsWUFBQSxRQUFRLEVBQUUsQ0FBQztBQUNYLFlBQUEsWUFBWSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUMvQixZQUFBLE9BQU8sb0JBQW9CLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxRQUFRLENBQUM7QUFDN0QsU0FBQyxDQUFDO2FBQ0QsT0FBTyxDQUFDLGlCQUFpQixFQUFFLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxNQUFNLEtBQUk7WUFDakQsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxFQUFFO0FBQ3ZDLGdCQUFBLE9BQU8sS0FBSyxDQUFDO2FBQ2Q7QUFFRCxZQUFBLFFBQVEsRUFBRSxDQUFDO0FBQ1gsWUFBQSxZQUFZLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQy9CLFlBQUEsT0FBTyxvQkFBb0IsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLFFBQVEsQ0FBQztBQUM3RCxTQUFDLENBQUM7YUFDRCxPQUFPLENBQUMsK0JBQStCLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxLQUFJO1lBQ3pELE9BQU8sWUFBWSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQztBQUM5QyxTQUFDLENBQUMsQ0FBQztRQUVMLE9BQU87QUFDTCxZQUFBLE9BQU8sRUFBRSxVQUFVO1lBQ25CLFFBQVE7U0FDVCxDQUFDO0tBQ0g7QUFFTyxJQUFBLE1BQU0seUJBQXlCLENBQ3JDLElBQVcsRUFDWCxNQUFjLEVBQUE7QUFFZCxRQUFBLE1BQU0sV0FBVyxHQUFHLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2hELE9BQU8sSUFBSSxDQUFDLGlDQUFpQyxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztLQUNsRTtBQUVPLElBQUEsTUFBTSxpQ0FBaUMsQ0FDN0MsSUFBVyxFQUNYLFdBQW1CLEVBQUE7UUFFbkIsSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDO0FBRWpCLFFBQUEsS0FBSyxNQUFNLFFBQVEsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxFQUFFO0FBQzdFLFlBQUEsSUFBSSxRQUFRLENBQUMsU0FBUyxLQUFLLFFBQVEsSUFBSSxRQUFRLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLEVBQUU7Z0JBQ2xFLFNBQVM7YUFDVjtBQUVELFlBQUEsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDcEQsWUFBQSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztBQUV0RSxZQUFBLElBQUksTUFBTSxDQUFDLE9BQU8sS0FBSyxPQUFPLEVBQUU7QUFDOUIsZ0JBQUEsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUN0RCxnQkFBQSxRQUFRLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQzthQUM3QjtTQUNGO0FBRUQsUUFBQSxPQUFPLFFBQVEsQ0FBQztLQUNqQjtBQUVPLElBQUEsTUFBTSxzQkFBc0IsR0FBQTtRQUNsQyxNQUFNLFVBQVUsR0FBRyxjQUFjLENBQUM7QUFDbEMsUUFBQSxJQUFJLEVBQUUsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUU7QUFDdEQsWUFBQSxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7U0FDaEQ7S0FDRjtBQUVPLElBQUEsc0JBQXNCLENBQUMsUUFBZ0IsRUFBQTtRQUM3QyxNQUFNLFFBQVEsR0FBRyxlQUFlLENBQUM7QUFDakMsUUFBQSxJQUFJLFVBQVUsR0FBRyxDQUFBLEVBQUcsUUFBUSxDQUFHLEVBQUEsUUFBUSxFQUFFLENBQUM7QUFFMUMsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsVUFBVSxDQUFDLEVBQUU7QUFDckQsWUFBQSxPQUFPLFVBQVUsQ0FBQztTQUNuQjtBQUVELFFBQUEsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQzdCLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDM0MsTUFBTSxRQUFRLEdBQUcsUUFBUSxHQUFHLENBQUMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsR0FBRyxRQUFRLENBQUM7QUFDdkUsUUFBQSxNQUFNLEdBQUcsR0FBRyxRQUFRLEdBQUcsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ3pELFVBQVUsR0FBRyxDQUFHLEVBQUEsUUFBUSxDQUFHLEVBQUEsUUFBUSxJQUFJLFNBQVMsQ0FBQSxFQUFHLEdBQUcsQ0FBQSxDQUFFLENBQUM7QUFFekQsUUFBQSxPQUFPLFVBQVUsQ0FBQztLQUNuQjtBQUVPLElBQUEscUJBQXFCLENBQUMsSUFBVSxFQUFBO0FBQ3RDLFFBQUEsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO1lBQ2IsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDO1NBQ2xCO0FBRUQsUUFBQSxJQUFJO1lBQ0YsTUFBTSxFQUFFLFFBQVEsRUFBRSxHQUFJLE1BQWMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDekQsWUFBQSxPQUFPLFFBQVEsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDdEM7QUFBQyxRQUFBLE1BQU07QUFDTixZQUFBLE9BQU8sSUFBSSxDQUFDO1NBQ2I7S0FDRjtBQUVPLElBQUEsY0FBYyxDQUFDLElBQVUsRUFBQTtRQUMvQixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSTtBQUNyQyxZQUFBLE1BQU0sTUFBTSxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7QUFDaEMsWUFBQSxNQUFNLENBQUMsTUFBTSxHQUFHLE1BQU0sT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDM0QsWUFBQSxNQUFNLENBQUMsT0FBTyxHQUFHLE1BQU0sTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUM1QyxZQUFBLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDMUIsU0FBQyxDQUFDLENBQUM7S0FDSjtJQUVPLE1BQU0sb0JBQW9CLENBQUMsSUFBVSxFQUFBO0FBQzNDLFFBQUEsTUFBTSxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUVwQyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzFELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVwRCxJQUFJLFVBQVUsRUFBRTtBQUNkLFlBQUEsTUFBTSxRQUFRLEdBQUdaLHNCQUFhLENBQzNCLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQTZCLENBQUMsV0FBVyxFQUFFLENBQzVELENBQUM7QUFDRixZQUFBLE1BQU0sZ0JBQWdCLEdBQUdBLHNCQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7QUFFbkQsWUFBQSxJQUNFLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxRQUFRLEdBQUcsR0FBRyxDQUFDO2dCQUMzQyxnQkFBZ0IsS0FBS0Esc0JBQWEsQ0FBQ0csbUJBQUksQ0FBQyxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUMsRUFDOUQ7QUFDQSxnQkFBQSxNQUFNLGNBQWMsR0FBRyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNuRSxnQkFBQSxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ2hFLGdCQUFBLE9BQU8sVUFBVSxDQUFDO2FBQ25CO1NBQ0Y7UUFFRCxNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDaEQsUUFBQSxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ3hELFFBQUEsT0FBTyxVQUFVLENBQUM7S0FDbkI7O0lBR0QsYUFBYSxHQUFBO1FBQ1gsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQztBQUVyQyxRQUFBLE1BQU0sUUFBUSxHQUNaLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQ2hCLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDaEIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsYUFBYSxFQUFFLENBQUM7QUFDdEQsUUFBQSxNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDakUsUUFBQSxNQUFNLFdBQVcsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDckUsSUFBSSxTQUFTLEdBQVksRUFBRSxDQUFDO0FBQzVCLFFBQUEsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFFN0QsUUFBQSxLQUFLLE1BQU0sS0FBSyxJQUFJLFNBQVMsRUFBRTtBQUM3QixZQUFBLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7QUFDN0IsWUFBQSxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO0FBRTlCLFlBQUEsSUFBSSxVQUFVLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUNqQyxTQUFTLENBQUMsSUFBSSxDQUFDO29CQUNiLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTtBQUNoQixvQkFBQSxJQUFJLEVBQUUsU0FBUztvQkFDZixNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU07QUFDckIsaUJBQUEsQ0FBQyxDQUFDO2FBQ0o7aUJBQU07Z0JBQ0wsTUFBTSxRQUFRLEdBQUdTLHVCQUFRLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7QUFDakQsZ0JBQUEsSUFBSSxJQUFJLENBQUM7O2dCQUVULElBQUksV0FBVyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFO29CQUN0QyxJQUFJLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO2lCQUMzQzs7QUFHRCxnQkFBQSxJQUNFLENBQUMsQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUM7b0JBQ2hELFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQ3ZDO29CQUNBLE1BQU0sUUFBUSxHQUFHRSxzQkFBTyxDQUN0QlgsbUJBQUksQ0FBQyxRQUFRLEVBQUVZLHNCQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQ3hDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FDdEIsQ0FBQztBQUVGLG9CQUFBLElBQUlDLHFCQUFVLENBQUMsUUFBUSxDQUFDLEVBQUU7QUFDeEIsd0JBQUEsTUFBTSxJQUFJLEdBQUdoQixzQkFBYSxDQUN4QkMsdUJBQVEsQ0FDTkQsc0JBQWEsQ0FBQyxRQUFRLENBQUMsRUFDdkJBLHNCQUFhLENBQ1hjLHNCQUFPLENBQ0xYLG1CQUFJLENBQUMsUUFBUSxFQUFFWSxzQkFBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUN4QyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQ3RCLENBQ0YsQ0FDRixDQUNGLENBQUM7QUFFRix3QkFBQSxJQUFJLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO3FCQUMxQjtpQkFDRjs7Z0JBRUQsSUFBSSxDQUFDLElBQUksRUFBRTtvQkFDVCxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7aUJBQ3hDO2dCQUVELElBQUksSUFBSSxFQUFFO29CQUNSLE1BQU0saUJBQWlCLEdBQUdaLG1CQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUVwRCxvQkFBQSxJQUFJLGtCQUFrQixDQUFDLGlCQUFpQixDQUFDLEVBQUU7d0JBQ3pDLFNBQVMsQ0FBQyxJQUFJLENBQUM7QUFDYiw0QkFBQSxJQUFJLEVBQUUsaUJBQWlCO0FBQ3ZCLDRCQUFBLElBQUksRUFBRSxTQUFTOzRCQUNmLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTTtBQUNyQix5QkFBQSxDQUFDLENBQUM7cUJBQ0o7aUJBQ0Y7YUFDRjtTQUNGO0FBRUQsUUFBQSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQzFCLFlBQUEsSUFBSXpCLGVBQU0sQ0FBQyxDQUFDLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDO1lBQ3pDLE9BQU87U0FDUjthQUFNO1lBQ0wsSUFBSUEsZUFBTSxDQUFDLENBQU0sR0FBQSxFQUFBLFNBQVMsQ0FBQyxNQUFNLENBQUEsVUFBQSxDQUFZLENBQUMsQ0FBQztTQUNoRDtRQUVELElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUc7QUFDckUsWUFBQSxJQUFJLEdBQUcsQ0FBQyxPQUFPLEVBQUU7QUFDZixnQkFBQSxJQUFJLGFBQWEsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDO2dCQUUvQixJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssYUFBYSxDQUFDLE1BQU0sRUFBRTtBQUM3QyxvQkFBQSxJQUFJQSxlQUFNLENBQ1IsQ0FBQyxDQUFDLDhEQUE4RCxDQUFDLENBQ2xFLENBQUM7aUJBQ0g7QUFFRCxnQkFBQSxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksSUFBRztBQUNuQixvQkFBQSxNQUFNLFdBQVcsR0FBRyxhQUFhLENBQUMsS0FBSyxFQUFFLENBQUM7b0JBRTFDLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUN0QyxPQUFPLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FDMUIsSUFBSSxDQUFDLE1BQU0sRUFDWCxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FDL0MsQ0FBQztBQUNKLGlCQUFDLENBQUMsQ0FBQztnQkFDSCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztnQkFDdkQsSUFBSSxVQUFVLENBQUMsSUFBSSxLQUFLLFdBQVcsQ0FBQyxJQUFJLEVBQUU7QUFDeEMsb0JBQUEsSUFBSUEsZUFBTSxDQUFDLENBQUMsQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDLENBQUM7b0JBQ3hELE9BQU87aUJBQ1I7QUFDRCxnQkFBQSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUU5QixnQkFBQSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFO0FBQzlCLG9CQUFBLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFHO3dCQUNwQixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUU7NEJBQ2xDbUMsaUJBQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLE1BQUssR0FBRyxDQUFDLENBQUM7eUJBQzlCO0FBQ0gscUJBQUMsQ0FBQyxDQUFDO2lCQUNKO2FBQ0Y7aUJBQU07QUFDTCxnQkFBQSxJQUFJbkMsZUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDO2FBQzVCO0FBQ0gsU0FBQyxDQUFDLENBQUM7S0FDSjtJQUVELGlCQUFpQixHQUFBO1FBQ2YsSUFBSSxDQUFDLGFBQWEsQ0FDaEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUNuQixjQUFjLEVBQ2QsQ0FBQyxHQUFtQixFQUFFLE1BQWMsRUFBRSxZQUEwQixLQUFJO0FBQ2xFLFlBQUEsSUFBSTtBQUNGLGdCQUFBLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQ2pELG1CQUFtQixFQUNuQixJQUFJLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUNqQyxDQUFDO0FBRUYsZ0JBQUEsSUFBSSxLQUFLLEdBQUcsR0FBRyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUM7Z0JBQ3BDLE9BQU8sQ0FBQyxHQUFHLENBQUMsOENBQThDLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUMzRSxPQUFPLENBQUMsR0FBRyxDQUNULCtCQUErQixFQUMvQixLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUNoQixPQUFPLEVBQ1AsS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FDakIsQ0FBQztnQkFFRixJQUFJLENBQUMsV0FBVyxFQUFFO29CQUNoQixPQUFPO2lCQUNSO2dCQUVELE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ3ZFLElBQUksUUFBUSxFQUFFO0FBQ1osb0JBQUEsT0FBTyxDQUFDLEdBQUcsQ0FDVCxtRUFBbUUsQ0FDcEUsQ0FBQztvQkFDRixHQUFHLENBQUMsY0FBYyxFQUFFLENBQUM7b0JBQ3JCLENBQUMsWUFBVztBQUNWLHdCQUFBLElBQUk7NEJBQ0YsTUFBTSxJQUFJLENBQUMsMEJBQTBCLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO3lCQUN6RDt3QkFBQyxPQUFPLEtBQUssRUFBRTtBQUNkLDRCQUFBLE9BQU8sQ0FBQyxLQUFLLENBQUMsOEJBQThCLEVBQUUsS0FBSyxDQUFDLENBQUM7eUJBQ3REO3FCQUNGLEdBQUcsQ0FBQztvQkFDTCxPQUFPO2lCQUNSOztBQUdELGdCQUFBLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUU7b0JBQy9CLE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQy9ELG9CQUFBLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxNQUFNO3lCQUMxQixZQUFZLENBQUMsY0FBYyxDQUFDO0FBQzVCLHlCQUFBLE1BQU0sQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7eUJBQzlDLE1BQU0sQ0FDTCxLQUFLLElBQ0gsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FDekIsS0FBSyxDQUFDLElBQUksRUFDVixJQUFJLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUNsQyxDQUNKLENBQUM7QUFFSixvQkFBQSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQzFCLHdCQUFBLElBQUksQ0FBQyxRQUFRO0FBQ1YsNkJBQUEsV0FBVyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzs2QkFDN0MsSUFBSSxDQUFDLEdBQUcsSUFBRzs0QkFDVixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBQ25DLDRCQUFBLElBQUksR0FBRyxDQUFDLE9BQU8sRUFBRTtBQUNmLGdDQUFBLElBQUksYUFBYSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUM7QUFDL0IsZ0NBQUEsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUc7QUFDbkIsb0NBQUEsTUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDLEtBQUssRUFBRSxDQUFDO29DQUMxQyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztvQ0FFdEMsS0FBSyxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQ3RCLElBQUksQ0FBQyxNQUFNLEVBQ1gsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQy9DLENBQUM7QUFDSixpQ0FBQyxDQUFDLENBQUM7QUFDSCxnQ0FBQSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQzs2QkFDN0I7aUNBQU07QUFDTCxnQ0FBQSxJQUFJQSxlQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7NkJBQzVCO0FBQ0gseUJBQUMsQ0FBQyxDQUFDO3FCQUNOO2lCQUNGOztnQkFHRCxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFO29CQUNyQyxJQUFJLENBQUMsNEJBQTRCLENBQy9CLE1BQU0sRUFDTixPQUFPLE1BQWMsRUFBRSxPQUFlLEtBQUk7QUFDeEMsd0JBQUEsSUFBSSxHQUFRLENBQUM7QUFDYix3QkFBQSxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLHFCQUFxQixDQUM3QyxHQUFHLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FDeEIsQ0FBQztBQUVGLHdCQUFBLElBQUksR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUU7NEJBQ2xCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQzs0QkFDbEQsT0FBTzt5QkFDUjtBQUNELHdCQUFBLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUM7QUFFckIsd0JBQUEsT0FBTyxHQUFHLENBQUM7cUJBQ1osRUFDRCxHQUFHLENBQUMsYUFBYSxDQUNsQixDQUFDLEtBQUssRUFBRSxDQUFDO29CQUNWLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQztpQkFDdEI7YUFDRjtZQUFDLE9BQU8sS0FBSyxFQUFFO0FBQ2QsZ0JBQUEsT0FBTyxDQUFDLEtBQUssQ0FBQyx5Q0FBeUMsRUFBRSxLQUFLLENBQUMsQ0FBQzthQUNqRTtvQkFBUzs7YUFFVDtTQUNGLENBQ0YsQ0FDRixDQUFDO1FBQ0YsSUFBSSxDQUFDLGFBQWEsQ0FDaEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUNuQixhQUFhLEVBQ2IsT0FBTyxHQUFjLEVBQUUsTUFBYyxFQUFFLFlBQTBCLEtBQUk7O0FBRW5FLFlBQUEsSUFBSSxHQUFHLENBQUMsT0FBTyxFQUFFO2dCQUNmLE9BQU87YUFDUjtBQUNELFlBQUEsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsQ0FDakQsbUJBQW1CLEVBQ25CLElBQUksQ0FBQyxRQUFRLENBQUMsa0JBQWtCLENBQ2pDLENBQUM7QUFDRixZQUFBLElBQUksS0FBSyxHQUFHLEdBQUcsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDO1lBRW5DLElBQUksQ0FBQyxXQUFXLEVBQUU7Z0JBQ2hCLE9BQU87YUFDUjtZQUVELE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDdkUsSUFBSSxRQUFRLEVBQUU7Z0JBQ1osR0FBRyxDQUFDLGNBQWMsRUFBRSxDQUFDO0FBQ3JCLGdCQUFBLElBQUk7b0JBQ0YsTUFBTSxJQUFJLENBQUMsMEJBQTBCLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2lCQUN6RDtnQkFBQyxPQUFPLEtBQUssRUFBRTtBQUNkLG9CQUFBLE9BQU8sQ0FBQyxLQUFLLENBQUMsOEJBQThCLEVBQUUsS0FBSyxDQUFDLENBQUM7aUJBQ3REO2dCQUNELE9BQU87YUFDUjtBQUVELFlBQUEsSUFDRSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUM7aUJBQ2pCLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztvQkFDaEMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDO0FBQ2pDLG9CQUFBLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQ3BDO2dCQUNBLElBQUksU0FBUyxHQUFrQixFQUFFLENBQUM7QUFDbEMsZ0JBQUEsSUFBSSxLQUFLLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUM7QUFDbkMsZ0JBQUEsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxLQUFJO0FBQ3hDLG9CQUFBLElBQUksSUFBSSxDQUFDLElBQUksRUFBRTtBQUNiLHdCQUFBLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO3FCQUMzQjt5QkFBTTt3QkFDTCxNQUFNLEVBQUUsUUFBUSxFQUFFLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO3dCQUN6QyxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzNDLHdCQUFBLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7cUJBQ3RCO0FBQ0gsaUJBQUMsQ0FBQyxDQUFDO2dCQUNILEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQztnQkFFckIsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUV4RCxnQkFBQSxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7b0JBQ2hCLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBYSxFQUFFLEtBQWEsS0FBSTt3QkFDL0MsSUFBSSxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQzVELHdCQUFBLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDMUMsd0JBQUEsSUFBSSxDQUFDLGtCQUFrQixDQUNyQixNQUFNLEVBQ04sT0FBTyxFQUNQLEtBQUssRUFDTCxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUNsQixDQUFDO0FBQ0oscUJBQUMsQ0FBQyxDQUFDO2lCQUNKO3FCQUFNO0FBQ0wsb0JBQUEsSUFBSUEsZUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDO2lCQUM1QjthQUNGO1NBQ0YsQ0FDRixDQUNGLENBQUM7S0FDSDtBQUVPLElBQUEsTUFBTSwwQkFBMEIsQ0FDdEMsTUFBYyxFQUNkLElBQVUsRUFBQTtRQUVWLE1BQU0sVUFBVSxHQUFHLE1BQU0sSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3pELE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0FBQ3pELFFBQUEsT0FBTyxVQUFVLENBQUM7S0FDbkI7QUFFRCxJQUFBLFNBQVMsQ0FBQyxhQUEyQixFQUFBO0FBQ25DLFFBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7QUFDekIsUUFBQSxNQUFNLEtBQUssR0FBRyxhQUFhLENBQUMsS0FBSyxDQUFDO1FBQ2xDLE1BQU0sSUFBSSxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7QUFFM0MsUUFBQSxNQUFNLFlBQVksR0FDaEIsS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDO2FBQ2pCLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztnQkFDaEMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDO2dCQUNqQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ3ZDLElBQUksWUFBWSxFQUFFO0FBQ2hCLFlBQUEsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFO0FBQ1YsZ0JBQUEsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQzthQUNqQztpQkFBTTtBQUNMLGdCQUFBLE9BQU8sSUFBSSxDQUFDO2FBQ2I7U0FDRjthQUFNO0FBQ0wsWUFBQSxPQUFPLEtBQUssQ0FBQztTQUNkO0tBQ0Y7QUFFRCxJQUFBLE1BQU0sNEJBQTRCLENBQ2hDLE1BQWMsRUFDZCxRQUFrQixFQUNsQixhQUEyQixFQUFBO1FBRTNCLElBQUksT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsRUFBRSxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM1RCxRQUFBLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDMUMsTUFBTSxJQUFJLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFFekMsUUFBQSxJQUFJO1lBQ0YsTUFBTSxHQUFHLEdBQUcsTUFBTSxRQUFRLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzVDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztTQUNyRDtRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDN0M7S0FDRjtJQUVELG1CQUFtQixDQUFDLE1BQWMsRUFBRSxPQUFlLEVBQUE7UUFDakQsSUFBSSxZQUFZLEdBQUcscUJBQXFCLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ2xFLFFBQUEsTUFBTSxDQUFDLGdCQUFnQixDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsQ0FBQztLQUM5QztJQUVPLE9BQU8sZUFBZSxDQUFDLEVBQVUsRUFBQTtRQUN2QyxPQUFPLENBQUEsbUJBQUEsRUFBc0IsRUFBRSxDQUFBLEdBQUEsQ0FBSyxDQUFDO0tBQ3RDO0lBRUQsa0JBQWtCLENBQ2hCLE1BQWMsRUFDZCxPQUFlLEVBQ2YsUUFBYSxFQUNiLE9BQWUsRUFBRSxFQUFBO1FBRWpCLElBQUksWUFBWSxHQUFHLHFCQUFxQixDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNsRSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXhDLElBQUksYUFBYSxHQUFHLGdCQUFnQixDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFaEUscUJBQXFCLENBQUMsc0JBQXNCLENBQzFDLE1BQU0sRUFDTixZQUFZLEVBQ1osYUFBYSxDQUNkLENBQUM7S0FDSDtBQUVELElBQUEsa0JBQWtCLENBQUMsTUFBYyxFQUFFLE9BQWUsRUFBRSxNQUFXLEVBQUE7QUFDN0QsUUFBQSxJQUFJQSxlQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDbkIsUUFBQSxPQUFPLENBQUMsS0FBSyxDQUFDLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzFDLElBQUksWUFBWSxHQUFHLHFCQUFxQixDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNsRSxxQkFBcUIsQ0FBQyxzQkFBc0IsQ0FDMUMsTUFBTSxFQUNOLFlBQVksRUFDWixvQ0FBb0MsQ0FDckMsQ0FBQztLQUNIO0FBRUQsSUFBQSxVQUFVLENBQUMsSUFBWSxFQUFBO1FBQ3JCLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxJQUFJLEVBQUUsQ0FBQztRQUU1RCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxLQUFLLFFBQVEsRUFBRTtBQUN4QyxZQUFBLE9BQU8sQ0FBRyxFQUFBLElBQUksQ0FBRyxFQUFBLGVBQWUsRUFBRSxDQUFDO1NBQ3BDO2FBQU0sSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsS0FBSyxNQUFNLEVBQUU7QUFDN0MsWUFBQSxPQUFPLEVBQUUsQ0FBQztTQUNYO2FBQU0sSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsS0FBSyxlQUFlLEVBQUU7QUFDdEQsWUFBQSxJQUFJLElBQUksS0FBSyxXQUFXLEVBQUU7QUFDeEIsZ0JBQUEsT0FBTyxFQUFFLENBQUM7YUFDWDtpQkFBTTtBQUNMLGdCQUFBLE9BQU8sQ0FBRyxFQUFBLElBQUksQ0FBRyxFQUFBLGVBQWUsRUFBRSxDQUFDO2FBQ3BDO1NBQ0Y7YUFBTTtBQUNMLFlBQUEsT0FBTyxDQUFHLEVBQUEsSUFBSSxDQUFHLEVBQUEsZUFBZSxFQUFFLENBQUM7U0FDcEM7S0FDRjtBQUVELElBQUEsT0FBTyxzQkFBc0IsQ0FDM0IsTUFBYyxFQUNkLE1BQWMsRUFDZCxXQUFtQixFQUFBO1FBRW5CLElBQUksS0FBSyxHQUFHLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDMUMsUUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUNyQyxJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2xDLFlBQUEsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7Z0JBQ1osSUFBSSxJQUFJLEdBQUcsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQztBQUMvQixnQkFBQSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQzdDLE1BQU0sQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDM0MsTUFBTTthQUNQO1NBQ0Y7S0FDRjtBQUVELElBQUEsTUFBTSxjQUFjLEdBQUE7QUFDbEIsUUFBQSxJQUFJO1lBQ0YsTUFBTSxRQUFRLEdBQUcsTUFBTSxLQUFLLENBQUMsQ0FBRyxFQUFBLGVBQWUsQ0FBZ0IsY0FBQSxDQUFBLENBQUMsQ0FBQztBQUVqRSxZQUFBLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxHQUFHLEVBQUU7QUFDM0IsZ0JBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLENBQUM7YUFDOUQ7QUFDRCxZQUFBLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFO0FBQ2hCLGdCQUFBLE9BQU8sRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQVEsS0FBQSxFQUFBLFFBQVEsQ0FBQyxNQUFNLENBQUEsQ0FBRSxFQUFFLENBQUM7YUFDNUU7WUFFRCxNQUFNLGNBQWMsSUFBSSxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBeUIsQ0FBQztBQUN2RSxZQUFBLE1BQU0sYUFBYSxHQUFHLGNBQWMsQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDO1lBQ25ELElBQUksQ0FBQyxhQUFhLEVBQUU7QUFDbEIsZ0JBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUM7YUFDNUQ7QUFFRCxZQUFBLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDO0FBQzdDLFlBQUEsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxhQUFhLEVBQUUsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzFFLFlBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLENBQUM7U0FDOUM7UUFBQyxPQUFPLEtBQUssRUFBRTtBQUNkLFlBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7U0FDaEU7S0FDRjtBQUVELElBQUEsTUFBTSxhQUFhLENBQUMsT0FBZSxFQUFFLFVBQWtELEVBQUE7UUFDckYsTUFBTSxJQUFJLENBQUMsMkJBQTJCLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzVELE1BQU0sSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7S0FDekM7QUFFTyxJQUFBLE1BQU0sMkJBQTJCLENBQ3ZDLE9BQWUsRUFDZixVQUFrRCxFQUFBO1FBRWxELE1BQU0sS0FBSyxHQUFHLENBQUMsU0FBUyxFQUFFLGVBQWUsRUFBRSxZQUFZLENBQVUsQ0FBQztRQUNsRSxNQUFNLFFBQVEsR0FBMkIsRUFBRSxDQUFDO0FBRTVDLFFBQUEsS0FBSyxJQUFJLEtBQUssR0FBRyxDQUFDLEVBQUUsS0FBSyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEVBQUU7QUFDakQsWUFBQSxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDMUIsTUFBTSxRQUFRLEdBQUcsTUFBTSxLQUFLLENBQUMsQ0FBRyxFQUFBLGVBQWUsQ0FBSSxDQUFBLEVBQUEsSUFBSSxDQUFFLENBQUEsQ0FBQyxDQUFDO0FBQzNELFlBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUU7Z0JBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsQ0FBTSxHQUFBLEVBQUEsSUFBSSxDQUFPLElBQUEsRUFBQSxRQUFRLENBQUMsTUFBTSxDQUFFLENBQUEsQ0FBQyxDQUFDO2FBQ3JEO1lBQ0QsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ3ZDLFVBQVUsR0FBRyxLQUFLLEdBQUcsQ0FBQyxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUN2QztBQUVELFFBQUEsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUM7UUFDcEMsSUFBSSxDQUFDLFNBQVMsRUFBRTtBQUNkLFlBQUEsTUFBTSxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUM3QjtBQUVELFFBQUEsTUFBTSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUcsRUFBQSxTQUFTLFVBQVUsRUFBRSxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztBQUNoRixRQUFBLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFHLEVBQUEsU0FBUyxnQkFBZ0IsRUFBRSxRQUFRLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztBQUM1RixRQUFBLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFHLEVBQUEsU0FBUyxhQUFhLEVBQUUsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7S0FDdkY7QUFFTyxJQUFBLE1BQU0sWUFBWSxDQUFDLE9BQWUsRUFBRSxJQUFJLEdBQUcsS0FBSyxFQUFBO0FBQ3RELFFBQUEsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7QUFDbEMsUUFBQSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO1FBRXJCLElBQUksSUFBSSxFQUFFOztBQUVSLFlBQUEsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQztZQUM1QixJQUFJLE9BQU8sSUFBSSxPQUFPLENBQUMsU0FBUyxFQUFFLEVBQUUsS0FBSyxRQUFRLEVBQUU7QUFDakQsZ0JBQUEsSUFBSSxDQUFDLHdCQUF3QixHQUFHLE9BQU8sQ0FBQztnQkFDeEMsSUFBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7Z0JBQzlCLE9BQU87YUFDUjtTQUNGO0FBRUQsUUFBQSxJQUFJQSxlQUFNLENBQUMsSUFBSSxHQUFHLENBQVMsTUFBQSxFQUFBLE9BQU8sQ0FBYSxXQUFBLENBQUEsR0FBRyxDQUFBLEtBQUEsRUFBUSxPQUFPLENBQUEsV0FBQSxDQUFhLENBQUMsQ0FBQztBQUVoRixRQUFBLE1BQU0sQ0FBQyxVQUFVLENBQUMsWUFBVztBQUMzQixZQUFBLElBQUk7O2dCQUVGLE1BQU0sR0FBRyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUM7O2dCQUV6QyxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBRXZDLGdCQUFBLE1BQU0sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEtBQUssTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQzs7QUFHaEUsZ0JBQUEsTUFBTSxHQUFHLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxDQUFDO0FBRWxDLGdCQUFBLE1BQU0sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEtBQUssTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQzs7Z0JBR2hFLE1BQU0sR0FBRyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7O2dCQUV2QyxNQUFNLEdBQUcsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBRXpDLGdCQUFBLE1BQU0sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEtBQUssTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQzs7QUFHaEUsZ0JBQUEsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQzs7QUFFbkIsZ0JBQUEsR0FBRyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7QUFFbEMsZ0JBQUEsSUFBSUEsZUFBTSxDQUFDLElBQUksR0FBRyxDQUFZLFNBQUEsRUFBQSxPQUFPLENBQUUsQ0FBQSxHQUFHLENBQUEsT0FBQSxFQUFVLE9BQU8sQ0FBQSxDQUFFLENBQUMsQ0FBQzthQUNoRTtZQUFDLE9BQU8sQ0FBQyxFQUFFO0FBQ1YsZ0JBQUEsT0FBTyxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNwRCxnQkFBQSxJQUFJQSxlQUFNLENBQUMsNkJBQTZCLENBQUMsQ0FBQzthQUMzQztTQUNGLEVBQUUsR0FBRyxDQUFDLENBQUM7S0FDVDtJQUVPLHNCQUFzQixHQUFBO1FBQzVCLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1FBQ25DLElBQUksQ0FBQyxzQkFBc0IsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQUs7QUFDcEQsWUFBQSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQzs7QUFFbEMsWUFBQSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQztZQUNqQyxJQUFJLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxTQUFTLEVBQUUsRUFBRSxLQUFLLFFBQVEsRUFBRTtnQkFDbEQsSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUM7QUFDbkMsZ0JBQUEsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixDQUFDO0FBQzlDLGdCQUFBLElBQUksQ0FBQyx3QkFBd0IsR0FBRyxFQUFFLENBQUM7Z0JBQ25DLElBQUksT0FBTyxFQUFFO29CQUNYLEtBQUssSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7aUJBQ3ZDO2FBQ0Y7U0FDRixFQUFFLElBQUksQ0FBQyxDQUFDO0tBQ1Y7SUFFTyx5QkFBeUIsR0FBQTtBQUMvQixRQUFBLElBQUksSUFBSSxDQUFDLG9CQUFvQixLQUFLLElBQUksRUFBRTtBQUN0QyxZQUFBLE1BQU0sQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7QUFDL0MsWUFBQSxJQUFJLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxDQUFDO1NBQ2xDO0tBQ0Y7SUFFTywyQkFBMkIsR0FBQTtBQUNqQyxRQUFBLElBQUksSUFBSSxDQUFDLHNCQUFzQixLQUFLLElBQUksRUFBRTtBQUN4QyxZQUFBLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLENBQUM7QUFDbEQsWUFBQSxJQUFJLENBQUMsc0JBQXNCLEdBQUcsSUFBSSxDQUFDO1NBQ3BDO0tBQ0Y7SUFFTyx1QkFBdUIsR0FBQTtRQUM3QixJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztRQUNqQyxJQUFJLENBQUMsb0JBQW9CLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxNQUFLO0FBQ2pELFlBQUEsS0FBSyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUMvQixJQUFJLENBQUMsZ0JBQWdCLENBQ25CLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBSztBQUN0QixnQkFBQSxLQUFLLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO2FBQ2hDLEVBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FDbkIsQ0FBQztBQUNKLFNBQUMsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7S0FDZjtBQUVPLElBQUEsTUFBTSxrQkFBa0IsR0FBQTtBQUM5QixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRTtZQUM3QixPQUFPO1NBQ1I7QUFFRCxRQUFBLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQzNDLElBQUksTUFBTSxDQUFDLEtBQUssSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUU7WUFDckMsT0FBTztTQUNSO1FBRUQsS0FBSyxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0tBQzdDO0lBRU8sTUFBTSxpQkFBaUIsQ0FBQyxPQUFlLEVBQUE7QUFDN0MsUUFBQSxJQUFJO0FBQ0YsWUFBQSxJQUFJQSxlQUFNLENBQUMsQ0FBQSxNQUFBLEVBQVMsT0FBTyxDQUFBLFVBQUEsQ0FBWSxDQUFDLENBQUM7QUFDekMsWUFBQSxNQUFNLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNoRCxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3hDO1FBQUMsT0FBTyxLQUFLLEVBQUU7QUFDZCxZQUFBLE9BQU8sQ0FBQyxLQUFLLENBQUMsbUNBQW1DLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDM0Q7S0FDRjtJQUVPLGVBQWUsQ0FBQyxFQUFVLEVBQUUsRUFBVSxFQUFBO0FBQzVDLFFBQUEsTUFBTSxZQUFZLEdBQUcsQ0FBQyxPQUFlLEtBQWM7QUFDakQsWUFBQSxPQUFPLE9BQU87QUFDWCxpQkFBQSxPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztpQkFDakIsS0FBSyxDQUFDLEdBQUcsQ0FBQztBQUNWLGlCQUFBLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSTtnQkFDWixNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2hDLGdCQUFBLE9BQU8sS0FBSyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzVDLGFBQUMsQ0FBQyxDQUFDO0FBQ1AsU0FBQyxDQUFDO0FBRUYsUUFBQSxNQUFNLE1BQU0sR0FBRyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDaEMsUUFBQSxNQUFNLE1BQU0sR0FBRyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDaEMsUUFBQSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBRXpELFFBQUEsS0FBSyxJQUFJLEtBQUssR0FBRyxDQUFDLEVBQUUsS0FBSyxHQUFHLFNBQVMsRUFBRSxLQUFLLEVBQUUsRUFBRTtZQUM5QyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzdCLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDN0IsSUFBSSxDQUFDLEdBQUcsQ0FBQztBQUFFLGdCQUFBLE9BQU8sQ0FBQyxDQUFDO1lBQ3BCLElBQUksQ0FBQyxHQUFHLENBQUM7Z0JBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztTQUN0QjtBQUNELFFBQUEsT0FBTyxDQUFDLENBQUM7S0FDVjtBQUNGOzs7OyIsInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDEsMiwzLDQsNSw2LDcsOCw5LDEwLDExLDEyLDEzLDE0LDE1LDE2LDE3LDE4LDE5LDIwLDIxLDIyLDIzLDI0LDI1LDI2LDI3LDI4LDI5LDMwLDMxLDMyLDMzLDM0LDM1LDM2LDM3LDM4LDM5LDQwLDQ0LDQ1LDQ2LDQ3LDQ4LDQ5LDUwLDUxLDUyLDUzLDU0LDU1LDU2XX0=
