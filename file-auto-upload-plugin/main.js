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
};
class SettingTab extends obsidian.PluginSettingTab {
    plugin;
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
    }
}

class imageAutoUploadPlugin extends obsidian.Plugin {
    settings;
    helper;
    editor;
    picGoUploader;
    picGoDeleter;
    picGoCoreUploader;
    uploader;
    async loadSettings() {
        this.settings = Object.assign(DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
    onunload() { }
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
        this.registerFileMenu();
        this.registerInterval(window.setInterval(() => {
            if (this.settings.autoCleanupRoot) {
                this.cleanupRootAssets().catch(error => {
                    console.error("Auto cleanup root assets failed: ", error);
                });
            }
        }, 30 * 60 * 1000));
        this.registerSelection();
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
            .filter(file => file.path === file.name && isAssetTypeAnAsset(file.path));
        result.scanned = rootAssets.length;
        for (const file of rootAssets) {
            try {
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
            const allowUpload = this.helper.getFrontmatterValue("image-auto-upload", this.settings.uploadByClipSwitch);
            evt.clipboardData.files;
            if (!allowUpload) {
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
}

module.exports = imageAutoUploadPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzLy5wbnBtL3BhdGgtYnJvd3NlcmlmeUAxLjAuMS9ub2RlX21vZHVsZXMvcGF0aC1icm93c2VyaWZ5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2lzZXhlQDIuMC4wL25vZGVfbW9kdWxlcy9pc2V4ZS93aW5kb3dzLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2lzZXhlQDIuMC4wL25vZGVfbW9kdWxlcy9pc2V4ZS9tb2RlLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2lzZXhlQDIuMC4wL25vZGVfbW9kdWxlcy9pc2V4ZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS93aGljaEAyLjAuMi9ub2RlX21vZHVsZXMvd2hpY2gvd2hpY2guanMiLCJub2RlX21vZHVsZXMvLnBucG0vcGF0aC1rZXlAMy4xLjEvbm9kZV9tb2R1bGVzL3BhdGgta2V5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2Nyb3NzLXNwYXduQDcuMC4zL25vZGVfbW9kdWxlcy9jcm9zcy1zcGF3bi9saWIvdXRpbC9yZXNvbHZlQ29tbWFuZC5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9jcm9zcy1zcGF3bkA3LjAuMy9ub2RlX21vZHVsZXMvY3Jvc3Mtc3Bhd24vbGliL3V0aWwvZXNjYXBlLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3NoZWJhbmctcmVnZXhAMy4wLjAvbm9kZV9tb2R1bGVzL3NoZWJhbmctcmVnZXgvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vc2hlYmFuZy1jb21tYW5kQDIuMC4wL25vZGVfbW9kdWxlcy9zaGViYW5nLWNvbW1hbmQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vY3Jvc3Mtc3Bhd25ANy4wLjMvbm9kZV9tb2R1bGVzL2Nyb3NzLXNwYXduL2xpYi91dGlsL3JlYWRTaGViYW5nLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2Nyb3NzLXNwYXduQDcuMC4zL25vZGVfbW9kdWxlcy9jcm9zcy1zcGF3bi9saWIvcGFyc2UuanMiLCJub2RlX21vZHVsZXMvLnBucG0vY3Jvc3Mtc3Bhd25ANy4wLjMvbm9kZV9tb2R1bGVzL2Nyb3NzLXNwYXduL2xpYi9lbm9lbnQuanMiLCJub2RlX21vZHVsZXMvLnBucG0vY3Jvc3Mtc3Bhd25ANy4wLjMvbm9kZV9tb2R1bGVzL2Nyb3NzLXNwYXduL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3N0cmlwLWZpbmFsLW5ld2xpbmVAMi4wLjAvbm9kZV9tb2R1bGVzL3N0cmlwLWZpbmFsLW5ld2xpbmUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vbnBtLXJ1bi1wYXRoQDQuMC4xL25vZGVfbW9kdWxlcy9ucG0tcnVuLXBhdGgvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vbWltaWMtZm5AMi4xLjAvbm9kZV9tb2R1bGVzL21pbWljLWZuL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL29uZXRpbWVANS4xLjIvbm9kZV9tb2R1bGVzL29uZXRpbWUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vaHVtYW4tc2lnbmFsc0AyLjEuMC9ub2RlX21vZHVsZXMvaHVtYW4tc2lnbmFscy9idWlsZC9zcmMvY29yZS5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9odW1hbi1zaWduYWxzQDIuMS4wL25vZGVfbW9kdWxlcy9odW1hbi1zaWduYWxzL2J1aWxkL3NyYy9yZWFsdGltZS5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9odW1hbi1zaWduYWxzQDIuMS4wL25vZGVfbW9kdWxlcy9odW1hbi1zaWduYWxzL2J1aWxkL3NyYy9zaWduYWxzLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2h1bWFuLXNpZ25hbHNAMi4xLjAvbm9kZV9tb2R1bGVzL2h1bWFuLXNpZ25hbHMvYnVpbGQvc3JjL21haW4uanMiLCJub2RlX21vZHVsZXMvLnBucG0vZXhlY2FANS4xLjEvbm9kZV9tb2R1bGVzL2V4ZWNhL2xpYi9lcnJvci5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9leGVjYUA1LjEuMS9ub2RlX21vZHVsZXMvZXhlY2EvbGliL3N0ZGlvLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3NpZ25hbC1leGl0QDMuMC43L25vZGVfbW9kdWxlcy9zaWduYWwtZXhpdC9zaWduYWxzLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3NpZ25hbC1leGl0QDMuMC43L25vZGVfbW9kdWxlcy9zaWduYWwtZXhpdC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9leGVjYUA1LjEuMS9ub2RlX21vZHVsZXMvZXhlY2EvbGliL2tpbGwuanMiLCJub2RlX21vZHVsZXMvLnBucG0vaXMtc3RyZWFtQDIuMC4xL25vZGVfbW9kdWxlcy9pcy1zdHJlYW0vaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vZ2V0LXN0cmVhbUA2LjAuMS9ub2RlX21vZHVsZXMvZ2V0LXN0cmVhbS9idWZmZXItc3RyZWFtLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2dldC1zdHJlYW1ANi4wLjEvbm9kZV9tb2R1bGVzL2dldC1zdHJlYW0vaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vbWVyZ2Utc3RyZWFtQDIuMC4wL25vZGVfbW9kdWxlcy9tZXJnZS1zdHJlYW0vaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vZXhlY2FANS4xLjEvbm9kZV9tb2R1bGVzL2V4ZWNhL2xpYi9zdHJlYW0uanMiLCJub2RlX21vZHVsZXMvLnBucG0vZXhlY2FANS4xLjEvbm9kZV9tb2R1bGVzL2V4ZWNhL2xpYi9wcm9taXNlLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2V4ZWNhQDUuMS4xL25vZGVfbW9kdWxlcy9leGVjYS9saWIvY29tbWFuZC5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9leGVjYUA1LjEuMS9ub2RlX21vZHVsZXMvZXhlY2EvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vYW5zaS1yZWdleEA2LjEuMC9ub2RlX21vZHVsZXMvYW5zaS1yZWdleC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9zdHJpcC1hbnNpQDcuMS4wL25vZGVfbW9kdWxlcy9zdHJpcC1hbnNpL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2RlZmF1bHQtc2hlbGxAMi4yLjAvbm9kZV9tb2R1bGVzL2RlZmF1bHQtc2hlbGwvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vc2hlbGwtZW52QDQuMC4xL25vZGVfbW9kdWxlcy9zaGVsbC1lbnYvaW5kZXguanMiLCJub2RlX21vZHVsZXMvLnBucG0vc2hlbGwtcGF0aEAzLjAuMC9ub2RlX21vZHVsZXMvc2hlbGwtcGF0aC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9maXgtcGF0aEA0LjAuMC9ub2RlX21vZHVsZXMvZml4LXBhdGgvaW5kZXguanMiLCJzcmMvdXRpbHMudHMiLCJub2RlX21vZHVsZXMvLnBucG0vdG9rZW4tdHlwZXNANS4wLjEvbm9kZV9tb2R1bGVzL3Rva2VuLXR5cGVzL2xpYi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9wZWVrLXJlYWRhYmxlQDUuMy4xL25vZGVfbW9kdWxlcy9wZWVrLXJlYWRhYmxlL2xpYi9FbmRPZlN0cmVhbUVycm9yLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3BlZWstcmVhZGFibGVANS4zLjEvbm9kZV9tb2R1bGVzL3BlZWstcmVhZGFibGUvbGliL0RlZmVycmVkLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3BlZWstcmVhZGFibGVANS4zLjEvbm9kZV9tb2R1bGVzL3BlZWstcmVhZGFibGUvbGliL0Fic3RyYWN0U3RyZWFtUmVhZGVyLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3BlZWstcmVhZGFibGVANS4zLjEvbm9kZV9tb2R1bGVzL3BlZWstcmVhZGFibGUvbGliL1N0cmVhbVJlYWRlci5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9zdHJ0b2szQDcuMS4xL25vZGVfbW9kdWxlcy9zdHJ0b2szL2xpYi9BYnN0cmFjdFRva2VuaXplci5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9zdHJ0b2szQDcuMS4xL25vZGVfbW9kdWxlcy9zdHJ0b2szL2xpYi9SZWFkU3RyZWFtVG9rZW5pemVyLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL3N0cnRvazNANy4xLjEvbm9kZV9tb2R1bGVzL3N0cnRvazMvbGliL0J1ZmZlclRva2VuaXplci5qcyIsIm5vZGVfbW9kdWxlcy8ucG5wbS9zdHJ0b2szQDcuMS4xL25vZGVfbW9kdWxlcy9zdHJ0b2szL2xpYi9jb3JlLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2ZpbGUtdHlwZUAxOC43LjAvbm9kZV9tb2R1bGVzL2ZpbGUtdHlwZS91dGlsLmpzIiwibm9kZV9tb2R1bGVzLy5wbnBtL2ZpbGUtdHlwZUAxOC43LjAvbm9kZV9tb2R1bGVzL2ZpbGUtdHlwZS9zdXBwb3J0ZWQuanMiLCJub2RlX21vZHVsZXMvLnBucG0vZmlsZS10eXBlQDE4LjcuMC9ub2RlX21vZHVsZXMvZmlsZS10eXBlL2NvcmUuanMiLCJub2RlX21vZHVsZXMvLnBucG0vaW1hZ2UtdHlwZUA1LjIuMC9ub2RlX21vZHVsZXMvaW1hZ2UtdHlwZS9pbmRleC5qcyIsInNyYy9sYW5nL2xvY2FsZS9hci50cyIsInNyYy9sYW5nL2xvY2FsZS9jei50cyIsInNyYy9sYW5nL2xvY2FsZS9kYS50cyIsInNyYy9sYW5nL2xvY2FsZS9kZS50cyIsInNyYy9sYW5nL2xvY2FsZS9lbi50cyIsInNyYy9sYW5nL2xvY2FsZS9lbi1nYi50cyIsInNyYy9sYW5nL2xvY2FsZS9lcy50cyIsInNyYy9sYW5nL2xvY2FsZS9mci50cyIsInNyYy9sYW5nL2xvY2FsZS9oaS50cyIsInNyYy9sYW5nL2xvY2FsZS9pZC50cyIsInNyYy9sYW5nL2xvY2FsZS9pdC50cyIsInNyYy9sYW5nL2xvY2FsZS9qYS50cyIsInNyYy9sYW5nL2xvY2FsZS9rby50cyIsInNyYy9sYW5nL2xvY2FsZS9ubC50cyIsInNyYy9sYW5nL2xvY2FsZS9uby50cyIsInNyYy9sYW5nL2xvY2FsZS9wbC50cyIsInNyYy9sYW5nL2xvY2FsZS9wdC50cyIsInNyYy9sYW5nL2xvY2FsZS9wdC1ici50cyIsInNyYy9sYW5nL2xvY2FsZS9yby50cyIsInNyYy9sYW5nL2xvY2FsZS9ydS50cyIsInNyYy9sYW5nL2xvY2FsZS90ci50cyIsInNyYy9sYW5nL2xvY2FsZS96aC1jbi50cyIsInNyYy9sYW5nL2xvY2FsZS96aC10dy50cyIsInNyYy9sYW5nL2hlbHBlcnMudHMiLCJzcmMvZG93bmxvYWQudHMiLCJzcmMvdXBsb2FkZXIudHMiLCJzcmMvZGVsZXRlci50cyIsInNyYy9oZWxwZXIudHMiLCJzcmMvc2V0dGluZy50cyIsInNyYy9tYWluLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vICdwYXRoJyBtb2R1bGUgZXh0cmFjdGVkIGZyb20gTm9kZS5qcyB2OC4xMS4xIChvbmx5IHRoZSBwb3NpeCBwYXJ0KVxuLy8gdHJhbnNwbGl0ZWQgd2l0aCBCYWJlbFxuXG4vLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBhc3NlcnRQYXRoKHBhdGgpIHtcbiAgaWYgKHR5cGVvZiBwYXRoICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1BhdGggbXVzdCBiZSBhIHN0cmluZy4gUmVjZWl2ZWQgJyArIEpTT04uc3RyaW5naWZ5KHBhdGgpKTtcbiAgfVxufVxuXG4vLyBSZXNvbHZlcyAuIGFuZCAuLiBlbGVtZW50cyBpbiBhIHBhdGggd2l0aCBkaXJlY3RvcnkgbmFtZXNcbmZ1bmN0aW9uIG5vcm1hbGl6ZVN0cmluZ1Bvc2l4KHBhdGgsIGFsbG93QWJvdmVSb290KSB7XG4gIHZhciByZXMgPSAnJztcbiAgdmFyIGxhc3RTZWdtZW50TGVuZ3RoID0gMDtcbiAgdmFyIGxhc3RTbGFzaCA9IC0xO1xuICB2YXIgZG90cyA9IDA7XG4gIHZhciBjb2RlO1xuICBmb3IgKHZhciBpID0gMDsgaSA8PSBwYXRoLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKGkgPCBwYXRoLmxlbmd0aClcbiAgICAgIGNvZGUgPSBwYXRoLmNoYXJDb2RlQXQoaSk7XG4gICAgZWxzZSBpZiAoY29kZSA9PT0gNDcgLyovKi8pXG4gICAgICBicmVhaztcbiAgICBlbHNlXG4gICAgICBjb2RlID0gNDcgLyovKi87XG4gICAgaWYgKGNvZGUgPT09IDQ3IC8qLyovKSB7XG4gICAgICBpZiAobGFzdFNsYXNoID09PSBpIC0gMSB8fCBkb3RzID09PSAxKSB7XG4gICAgICAgIC8vIE5PT1BcbiAgICAgIH0gZWxzZSBpZiAobGFzdFNsYXNoICE9PSBpIC0gMSAmJiBkb3RzID09PSAyKSB7XG4gICAgICAgIGlmIChyZXMubGVuZ3RoIDwgMiB8fCBsYXN0U2VnbWVudExlbmd0aCAhPT0gMiB8fCByZXMuY2hhckNvZGVBdChyZXMubGVuZ3RoIC0gMSkgIT09IDQ2IC8qLiovIHx8IHJlcy5jaGFyQ29kZUF0KHJlcy5sZW5ndGggLSAyKSAhPT0gNDYgLyouKi8pIHtcbiAgICAgICAgICBpZiAocmVzLmxlbmd0aCA+IDIpIHtcbiAgICAgICAgICAgIHZhciBsYXN0U2xhc2hJbmRleCA9IHJlcy5sYXN0SW5kZXhPZignLycpO1xuICAgICAgICAgICAgaWYgKGxhc3RTbGFzaEluZGV4ICE9PSByZXMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICBpZiAobGFzdFNsYXNoSW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgcmVzID0gJyc7XG4gICAgICAgICAgICAgICAgbGFzdFNlZ21lbnRMZW5ndGggPSAwO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlcyA9IHJlcy5zbGljZSgwLCBsYXN0U2xhc2hJbmRleCk7XG4gICAgICAgICAgICAgICAgbGFzdFNlZ21lbnRMZW5ndGggPSByZXMubGVuZ3RoIC0gMSAtIHJlcy5sYXN0SW5kZXhPZignLycpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGxhc3RTbGFzaCA9IGk7XG4gICAgICAgICAgICAgIGRvdHMgPSAwO1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKHJlcy5sZW5ndGggPT09IDIgfHwgcmVzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgcmVzID0gJyc7XG4gICAgICAgICAgICBsYXN0U2VnbWVudExlbmd0aCA9IDA7XG4gICAgICAgICAgICBsYXN0U2xhc2ggPSBpO1xuICAgICAgICAgICAgZG90cyA9IDA7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFsbG93QWJvdmVSb290KSB7XG4gICAgICAgICAgaWYgKHJlcy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgcmVzICs9ICcvLi4nO1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJlcyA9ICcuLic7XG4gICAgICAgICAgbGFzdFNlZ21lbnRMZW5ndGggPSAyO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocmVzLmxlbmd0aCA+IDApXG4gICAgICAgICAgcmVzICs9ICcvJyArIHBhdGguc2xpY2UobGFzdFNsYXNoICsgMSwgaSk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICByZXMgPSBwYXRoLnNsaWNlKGxhc3RTbGFzaCArIDEsIGkpO1xuICAgICAgICBsYXN0U2VnbWVudExlbmd0aCA9IGkgLSBsYXN0U2xhc2ggLSAxO1xuICAgICAgfVxuICAgICAgbGFzdFNsYXNoID0gaTtcbiAgICAgIGRvdHMgPSAwO1xuICAgIH0gZWxzZSBpZiAoY29kZSA9PT0gNDYgLyouKi8gJiYgZG90cyAhPT0gLTEpIHtcbiAgICAgICsrZG90cztcbiAgICB9IGVsc2Uge1xuICAgICAgZG90cyA9IC0xO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG5mdW5jdGlvbiBfZm9ybWF0KHNlcCwgcGF0aE9iamVjdCkge1xuICB2YXIgZGlyID0gcGF0aE9iamVjdC5kaXIgfHwgcGF0aE9iamVjdC5yb290O1xuICB2YXIgYmFzZSA9IHBhdGhPYmplY3QuYmFzZSB8fCAocGF0aE9iamVjdC5uYW1lIHx8ICcnKSArIChwYXRoT2JqZWN0LmV4dCB8fCAnJyk7XG4gIGlmICghZGlyKSB7XG4gICAgcmV0dXJuIGJhc2U7XG4gIH1cbiAgaWYgKGRpciA9PT0gcGF0aE9iamVjdC5yb290KSB7XG4gICAgcmV0dXJuIGRpciArIGJhc2U7XG4gIH1cbiAgcmV0dXJuIGRpciArIHNlcCArIGJhc2U7XG59XG5cbnZhciBwb3NpeCA9IHtcbiAgLy8gcGF0aC5yZXNvbHZlKFtmcm9tIC4uLl0sIHRvKVxuICByZXNvbHZlOiBmdW5jdGlvbiByZXNvbHZlKCkge1xuICAgIHZhciByZXNvbHZlZFBhdGggPSAnJztcbiAgICB2YXIgcmVzb2x2ZWRBYnNvbHV0ZSA9IGZhbHNlO1xuICAgIHZhciBjd2Q7XG5cbiAgICBmb3IgKHZhciBpID0gYXJndW1lbnRzLmxlbmd0aCAtIDE7IGkgPj0gLTEgJiYgIXJlc29sdmVkQWJzb2x1dGU7IGktLSkge1xuICAgICAgdmFyIHBhdGg7XG4gICAgICBpZiAoaSA+PSAwKVxuICAgICAgICBwYXRoID0gYXJndW1lbnRzW2ldO1xuICAgICAgZWxzZSB7XG4gICAgICAgIGlmIChjd2QgPT09IHVuZGVmaW5lZClcbiAgICAgICAgICBjd2QgPSBwcm9jZXNzLmN3ZCgpO1xuICAgICAgICBwYXRoID0gY3dkO1xuICAgICAgfVxuXG4gICAgICBhc3NlcnRQYXRoKHBhdGgpO1xuXG4gICAgICAvLyBTa2lwIGVtcHR5IGVudHJpZXNcbiAgICAgIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgcmVzb2x2ZWRQYXRoID0gcGF0aCArICcvJyArIHJlc29sdmVkUGF0aDtcbiAgICAgIHJlc29sdmVkQWJzb2x1dGUgPSBwYXRoLmNoYXJDb2RlQXQoMCkgPT09IDQ3IC8qLyovO1xuICAgIH1cblxuICAgIC8vIEF0IHRoaXMgcG9pbnQgdGhlIHBhdGggc2hvdWxkIGJlIHJlc29sdmVkIHRvIGEgZnVsbCBhYnNvbHV0ZSBwYXRoLCBidXRcbiAgICAvLyBoYW5kbGUgcmVsYXRpdmUgcGF0aHMgdG8gYmUgc2FmZSAobWlnaHQgaGFwcGVuIHdoZW4gcHJvY2Vzcy5jd2QoKSBmYWlscylcblxuICAgIC8vIE5vcm1hbGl6ZSB0aGUgcGF0aFxuICAgIHJlc29sdmVkUGF0aCA9IG5vcm1hbGl6ZVN0cmluZ1Bvc2l4KHJlc29sdmVkUGF0aCwgIXJlc29sdmVkQWJzb2x1dGUpO1xuXG4gICAgaWYgKHJlc29sdmVkQWJzb2x1dGUpIHtcbiAgICAgIGlmIChyZXNvbHZlZFBhdGgubGVuZ3RoID4gMClcbiAgICAgICAgcmV0dXJuICcvJyArIHJlc29sdmVkUGF0aDtcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuICcvJztcbiAgICB9IGVsc2UgaWYgKHJlc29sdmVkUGF0aC5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZWRQYXRoO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gJy4nO1xuICAgIH1cbiAgfSxcblxuICBub3JtYWxpemU6IGZ1bmN0aW9uIG5vcm1hbGl6ZShwYXRoKSB7XG4gICAgYXNzZXJ0UGF0aChwYXRoKTtcblxuICAgIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkgcmV0dXJuICcuJztcblxuICAgIHZhciBpc0Fic29sdXRlID0gcGF0aC5jaGFyQ29kZUF0KDApID09PSA0NyAvKi8qLztcbiAgICB2YXIgdHJhaWxpbmdTZXBhcmF0b3IgPSBwYXRoLmNoYXJDb2RlQXQocGF0aC5sZW5ndGggLSAxKSA9PT0gNDcgLyovKi87XG5cbiAgICAvLyBOb3JtYWxpemUgdGhlIHBhdGhcbiAgICBwYXRoID0gbm9ybWFsaXplU3RyaW5nUG9zaXgocGF0aCwgIWlzQWJzb2x1dGUpO1xuXG4gICAgaWYgKHBhdGgubGVuZ3RoID09PSAwICYmICFpc0Fic29sdXRlKSBwYXRoID0gJy4nO1xuICAgIGlmIChwYXRoLmxlbmd0aCA+IDAgJiYgdHJhaWxpbmdTZXBhcmF0b3IpIHBhdGggKz0gJy8nO1xuXG4gICAgaWYgKGlzQWJzb2x1dGUpIHJldHVybiAnLycgKyBwYXRoO1xuICAgIHJldHVybiBwYXRoO1xuICB9LFxuXG4gIGlzQWJzb2x1dGU6IGZ1bmN0aW9uIGlzQWJzb2x1dGUocGF0aCkge1xuICAgIGFzc2VydFBhdGgocGF0aCk7XG4gICAgcmV0dXJuIHBhdGgubGVuZ3RoID4gMCAmJiBwYXRoLmNoYXJDb2RlQXQoMCkgPT09IDQ3IC8qLyovO1xuICB9LFxuXG4gIGpvaW46IGZ1bmN0aW9uIGpvaW4oKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICByZXR1cm4gJy4nO1xuICAgIHZhciBqb2luZWQ7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgIHZhciBhcmcgPSBhcmd1bWVudHNbaV07XG4gICAgICBhc3NlcnRQYXRoKGFyZyk7XG4gICAgICBpZiAoYXJnLmxlbmd0aCA+IDApIHtcbiAgICAgICAgaWYgKGpvaW5lZCA9PT0gdW5kZWZpbmVkKVxuICAgICAgICAgIGpvaW5lZCA9IGFyZztcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGpvaW5lZCArPSAnLycgKyBhcmc7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChqb2luZWQgPT09IHVuZGVmaW5lZClcbiAgICAgIHJldHVybiAnLic7XG4gICAgcmV0dXJuIHBvc2l4Lm5vcm1hbGl6ZShqb2luZWQpO1xuICB9LFxuXG4gIHJlbGF0aXZlOiBmdW5jdGlvbiByZWxhdGl2ZShmcm9tLCB0bykge1xuICAgIGFzc2VydFBhdGgoZnJvbSk7XG4gICAgYXNzZXJ0UGF0aCh0byk7XG5cbiAgICBpZiAoZnJvbSA9PT0gdG8pIHJldHVybiAnJztcblxuICAgIGZyb20gPSBwb3NpeC5yZXNvbHZlKGZyb20pO1xuICAgIHRvID0gcG9zaXgucmVzb2x2ZSh0byk7XG5cbiAgICBpZiAoZnJvbSA9PT0gdG8pIHJldHVybiAnJztcblxuICAgIC8vIFRyaW0gYW55IGxlYWRpbmcgYmFja3NsYXNoZXNcbiAgICB2YXIgZnJvbVN0YXJ0ID0gMTtcbiAgICBmb3IgKDsgZnJvbVN0YXJ0IDwgZnJvbS5sZW5ndGg7ICsrZnJvbVN0YXJ0KSB7XG4gICAgICBpZiAoZnJvbS5jaGFyQ29kZUF0KGZyb21TdGFydCkgIT09IDQ3IC8qLyovKVxuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgdmFyIGZyb21FbmQgPSBmcm9tLmxlbmd0aDtcbiAgICB2YXIgZnJvbUxlbiA9IGZyb21FbmQgLSBmcm9tU3RhcnQ7XG5cbiAgICAvLyBUcmltIGFueSBsZWFkaW5nIGJhY2tzbGFzaGVzXG4gICAgdmFyIHRvU3RhcnQgPSAxO1xuICAgIGZvciAoOyB0b1N0YXJ0IDwgdG8ubGVuZ3RoOyArK3RvU3RhcnQpIHtcbiAgICAgIGlmICh0by5jaGFyQ29kZUF0KHRvU3RhcnQpICE9PSA0NyAvKi8qLylcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHZhciB0b0VuZCA9IHRvLmxlbmd0aDtcbiAgICB2YXIgdG9MZW4gPSB0b0VuZCAtIHRvU3RhcnQ7XG5cbiAgICAvLyBDb21wYXJlIHBhdGhzIHRvIGZpbmQgdGhlIGxvbmdlc3QgY29tbW9uIHBhdGggZnJvbSByb290XG4gICAgdmFyIGxlbmd0aCA9IGZyb21MZW4gPCB0b0xlbiA/IGZyb21MZW4gOiB0b0xlbjtcbiAgICB2YXIgbGFzdENvbW1vblNlcCA9IC0xO1xuICAgIHZhciBpID0gMDtcbiAgICBmb3IgKDsgaSA8PSBsZW5ndGg7ICsraSkge1xuICAgICAgaWYgKGkgPT09IGxlbmd0aCkge1xuICAgICAgICBpZiAodG9MZW4gPiBsZW5ndGgpIHtcbiAgICAgICAgICBpZiAodG8uY2hhckNvZGVBdCh0b1N0YXJ0ICsgaSkgPT09IDQ3IC8qLyovKSB7XG4gICAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgZnJvbWAgaXMgdGhlIGV4YWN0IGJhc2UgcGF0aCBmb3IgYHRvYC5cbiAgICAgICAgICAgIC8vIEZvciBleGFtcGxlOiBmcm9tPScvZm9vL2Jhcic7IHRvPScvZm9vL2Jhci9iYXonXG4gICAgICAgICAgICByZXR1cm4gdG8uc2xpY2UodG9TdGFydCArIGkgKyAxKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGkgPT09IDApIHtcbiAgICAgICAgICAgIC8vIFdlIGdldCBoZXJlIGlmIGBmcm9tYCBpcyB0aGUgcm9vdFxuICAgICAgICAgICAgLy8gRm9yIGV4YW1wbGU6IGZyb209Jy8nOyB0bz0nL2ZvbydcbiAgICAgICAgICAgIHJldHVybiB0by5zbGljZSh0b1N0YXJ0ICsgaSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGZyb21MZW4gPiBsZW5ndGgpIHtcbiAgICAgICAgICBpZiAoZnJvbS5jaGFyQ29kZUF0KGZyb21TdGFydCArIGkpID09PSA0NyAvKi8qLykge1xuICAgICAgICAgICAgLy8gV2UgZ2V0IGhlcmUgaWYgYHRvYCBpcyB0aGUgZXhhY3QgYmFzZSBwYXRoIGZvciBgZnJvbWAuXG4gICAgICAgICAgICAvLyBGb3IgZXhhbXBsZTogZnJvbT0nL2Zvby9iYXIvYmF6JzsgdG89Jy9mb28vYmFyJ1xuICAgICAgICAgICAgbGFzdENvbW1vblNlcCA9IGk7XG4gICAgICAgICAgfSBlbHNlIGlmIChpID09PSAwKSB7XG4gICAgICAgICAgICAvLyBXZSBnZXQgaGVyZSBpZiBgdG9gIGlzIHRoZSByb290LlxuICAgICAgICAgICAgLy8gRm9yIGV4YW1wbGU6IGZyb209Jy9mb28nOyB0bz0nLydcbiAgICAgICAgICAgIGxhc3RDb21tb25TZXAgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHZhciBmcm9tQ29kZSA9IGZyb20uY2hhckNvZGVBdChmcm9tU3RhcnQgKyBpKTtcbiAgICAgIHZhciB0b0NvZGUgPSB0by5jaGFyQ29kZUF0KHRvU3RhcnQgKyBpKTtcbiAgICAgIGlmIChmcm9tQ29kZSAhPT0gdG9Db2RlKVxuICAgICAgICBicmVhaztcbiAgICAgIGVsc2UgaWYgKGZyb21Db2RlID09PSA0NyAvKi8qLylcbiAgICAgICAgbGFzdENvbW1vblNlcCA9IGk7XG4gICAgfVxuXG4gICAgdmFyIG91dCA9ICcnO1xuICAgIC8vIEdlbmVyYXRlIHRoZSByZWxhdGl2ZSBwYXRoIGJhc2VkIG9uIHRoZSBwYXRoIGRpZmZlcmVuY2UgYmV0d2VlbiBgdG9gXG4gICAgLy8gYW5kIGBmcm9tYFxuICAgIGZvciAoaSA9IGZyb21TdGFydCArIGxhc3RDb21tb25TZXAgKyAxOyBpIDw9IGZyb21FbmQ7ICsraSkge1xuICAgICAgaWYgKGkgPT09IGZyb21FbmQgfHwgZnJvbS5jaGFyQ29kZUF0KGkpID09PSA0NyAvKi8qLykge1xuICAgICAgICBpZiAob3V0Lmxlbmd0aCA9PT0gMClcbiAgICAgICAgICBvdXQgKz0gJy4uJztcbiAgICAgICAgZWxzZVxuICAgICAgICAgIG91dCArPSAnLy4uJztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBMYXN0bHksIGFwcGVuZCB0aGUgcmVzdCBvZiB0aGUgZGVzdGluYXRpb24gKGB0b2ApIHBhdGggdGhhdCBjb21lcyBhZnRlclxuICAgIC8vIHRoZSBjb21tb24gcGF0aCBwYXJ0c1xuICAgIGlmIChvdXQubGVuZ3RoID4gMClcbiAgICAgIHJldHVybiBvdXQgKyB0by5zbGljZSh0b1N0YXJ0ICsgbGFzdENvbW1vblNlcCk7XG4gICAgZWxzZSB7XG4gICAgICB0b1N0YXJ0ICs9IGxhc3RDb21tb25TZXA7XG4gICAgICBpZiAodG8uY2hhckNvZGVBdCh0b1N0YXJ0KSA9PT0gNDcgLyovKi8pXG4gICAgICAgICsrdG9TdGFydDtcbiAgICAgIHJldHVybiB0by5zbGljZSh0b1N0YXJ0KTtcbiAgICB9XG4gIH0sXG5cbiAgX21ha2VMb25nOiBmdW5jdGlvbiBfbWFrZUxvbmcocGF0aCkge1xuICAgIHJldHVybiBwYXRoO1xuICB9LFxuXG4gIGRpcm5hbWU6IGZ1bmN0aW9uIGRpcm5hbWUocGF0aCkge1xuICAgIGFzc2VydFBhdGgocGF0aCk7XG4gICAgaWYgKHBhdGgubGVuZ3RoID09PSAwKSByZXR1cm4gJy4nO1xuICAgIHZhciBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KDApO1xuICAgIHZhciBoYXNSb290ID0gY29kZSA9PT0gNDcgLyovKi87XG4gICAgdmFyIGVuZCA9IC0xO1xuICAgIHZhciBtYXRjaGVkU2xhc2ggPSB0cnVlO1xuICAgIGZvciAodmFyIGkgPSBwYXRoLmxlbmd0aCAtIDE7IGkgPj0gMTsgLS1pKSB7XG4gICAgICBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KGkpO1xuICAgICAgaWYgKGNvZGUgPT09IDQ3IC8qLyovKSB7XG4gICAgICAgICAgaWYgKCFtYXRjaGVkU2xhc2gpIHtcbiAgICAgICAgICAgIGVuZCA9IGk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yXG4gICAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChlbmQgPT09IC0xKSByZXR1cm4gaGFzUm9vdCA/ICcvJyA6ICcuJztcbiAgICBpZiAoaGFzUm9vdCAmJiBlbmQgPT09IDEpIHJldHVybiAnLy8nO1xuICAgIHJldHVybiBwYXRoLnNsaWNlKDAsIGVuZCk7XG4gIH0sXG5cbiAgYmFzZW5hbWU6IGZ1bmN0aW9uIGJhc2VuYW1lKHBhdGgsIGV4dCkge1xuICAgIGlmIChleHQgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgZXh0ICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJleHRcIiBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nJyk7XG4gICAgYXNzZXJ0UGF0aChwYXRoKTtcblxuICAgIHZhciBzdGFydCA9IDA7XG4gICAgdmFyIGVuZCA9IC0xO1xuICAgIHZhciBtYXRjaGVkU2xhc2ggPSB0cnVlO1xuICAgIHZhciBpO1xuXG4gICAgaWYgKGV4dCAhPT0gdW5kZWZpbmVkICYmIGV4dC5sZW5ndGggPiAwICYmIGV4dC5sZW5ndGggPD0gcGF0aC5sZW5ndGgpIHtcbiAgICAgIGlmIChleHQubGVuZ3RoID09PSBwYXRoLmxlbmd0aCAmJiBleHQgPT09IHBhdGgpIHJldHVybiAnJztcbiAgICAgIHZhciBleHRJZHggPSBleHQubGVuZ3RoIC0gMTtcbiAgICAgIHZhciBmaXJzdE5vblNsYXNoRW5kID0gLTE7XG4gICAgICBmb3IgKGkgPSBwYXRoLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICAgIHZhciBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KGkpO1xuICAgICAgICBpZiAoY29kZSA9PT0gNDcgLyovKi8pIHtcbiAgICAgICAgICAgIC8vIElmIHdlIHJlYWNoZWQgYSBwYXRoIHNlcGFyYXRvciB0aGF0IHdhcyBub3QgcGFydCBvZiBhIHNldCBvZiBwYXRoXG4gICAgICAgICAgICAvLyBzZXBhcmF0b3JzIGF0IHRoZSBlbmQgb2YgdGhlIHN0cmluZywgc3RvcCBub3dcbiAgICAgICAgICAgIGlmICghbWF0Y2hlZFNsYXNoKSB7XG4gICAgICAgICAgICAgIHN0YXJ0ID0gaSArIDE7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGZpcnN0Tm9uU2xhc2hFbmQgPT09IC0xKSB7XG4gICAgICAgICAgICAvLyBXZSBzYXcgdGhlIGZpcnN0IG5vbi1wYXRoIHNlcGFyYXRvciwgcmVtZW1iZXIgdGhpcyBpbmRleCBpbiBjYXNlXG4gICAgICAgICAgICAvLyB3ZSBuZWVkIGl0IGlmIHRoZSBleHRlbnNpb24gZW5kcyB1cCBub3QgbWF0Y2hpbmdcbiAgICAgICAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgICAgICAgICAgZmlyc3ROb25TbGFzaEVuZCA9IGkgKyAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZXh0SWR4ID49IDApIHtcbiAgICAgICAgICAgIC8vIFRyeSB0byBtYXRjaCB0aGUgZXhwbGljaXQgZXh0ZW5zaW9uXG4gICAgICAgICAgICBpZiAoY29kZSA9PT0gZXh0LmNoYXJDb2RlQXQoZXh0SWR4KSkge1xuICAgICAgICAgICAgICBpZiAoLS1leHRJZHggPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgLy8gV2UgbWF0Y2hlZCB0aGUgZXh0ZW5zaW9uLCBzbyBtYXJrIHRoaXMgYXMgdGhlIGVuZCBvZiBvdXIgcGF0aFxuICAgICAgICAgICAgICAgIC8vIGNvbXBvbmVudFxuICAgICAgICAgICAgICAgIGVuZCA9IGk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIEV4dGVuc2lvbiBkb2VzIG5vdCBtYXRjaCwgc28gb3VyIHJlc3VsdCBpcyB0aGUgZW50aXJlIHBhdGhcbiAgICAgICAgICAgICAgLy8gY29tcG9uZW50XG4gICAgICAgICAgICAgIGV4dElkeCA9IC0xO1xuICAgICAgICAgICAgICBlbmQgPSBmaXJzdE5vblNsYXNoRW5kO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoc3RhcnQgPT09IGVuZCkgZW5kID0gZmlyc3ROb25TbGFzaEVuZDtlbHNlIGlmIChlbmQgPT09IC0xKSBlbmQgPSBwYXRoLmxlbmd0aDtcbiAgICAgIHJldHVybiBwYXRoLnNsaWNlKHN0YXJ0LCBlbmQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGkgPSBwYXRoLmxlbmd0aCAtIDE7IGkgPj0gMDsgLS1pKSB7XG4gICAgICAgIGlmIChwYXRoLmNoYXJDb2RlQXQoaSkgPT09IDQ3IC8qLyovKSB7XG4gICAgICAgICAgICAvLyBJZiB3ZSByZWFjaGVkIGEgcGF0aCBzZXBhcmF0b3IgdGhhdCB3YXMgbm90IHBhcnQgb2YgYSBzZXQgb2YgcGF0aFxuICAgICAgICAgICAgLy8gc2VwYXJhdG9ycyBhdCB0aGUgZW5kIG9mIHRoZSBzdHJpbmcsIHN0b3Agbm93XG4gICAgICAgICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICAgICAgICBzdGFydCA9IGkgKyAxO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKGVuZCA9PT0gLTEpIHtcbiAgICAgICAgICAvLyBXZSBzYXcgdGhlIGZpcnN0IG5vbi1wYXRoIHNlcGFyYXRvciwgbWFyayB0aGlzIGFzIHRoZSBlbmQgb2Ygb3VyXG4gICAgICAgICAgLy8gcGF0aCBjb21wb25lbnRcbiAgICAgICAgICBtYXRjaGVkU2xhc2ggPSBmYWxzZTtcbiAgICAgICAgICBlbmQgPSBpICsgMTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZW5kID09PSAtMSkgcmV0dXJuICcnO1xuICAgICAgcmV0dXJuIHBhdGguc2xpY2Uoc3RhcnQsIGVuZCk7XG4gICAgfVxuICB9LFxuXG4gIGV4dG5hbWU6IGZ1bmN0aW9uIGV4dG5hbWUocGF0aCkge1xuICAgIGFzc2VydFBhdGgocGF0aCk7XG4gICAgdmFyIHN0YXJ0RG90ID0gLTE7XG4gICAgdmFyIHN0YXJ0UGFydCA9IDA7XG4gICAgdmFyIGVuZCA9IC0xO1xuICAgIHZhciBtYXRjaGVkU2xhc2ggPSB0cnVlO1xuICAgIC8vIFRyYWNrIHRoZSBzdGF0ZSBvZiBjaGFyYWN0ZXJzIChpZiBhbnkpIHdlIHNlZSBiZWZvcmUgb3VyIGZpcnN0IGRvdCBhbmRcbiAgICAvLyBhZnRlciBhbnkgcGF0aCBzZXBhcmF0b3Igd2UgZmluZFxuICAgIHZhciBwcmVEb3RTdGF0ZSA9IDA7XG4gICAgZm9yICh2YXIgaSA9IHBhdGgubGVuZ3RoIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgIHZhciBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KGkpO1xuICAgICAgaWYgKGNvZGUgPT09IDQ3IC8qLyovKSB7XG4gICAgICAgICAgLy8gSWYgd2UgcmVhY2hlZCBhIHBhdGggc2VwYXJhdG9yIHRoYXQgd2FzIG5vdCBwYXJ0IG9mIGEgc2V0IG9mIHBhdGhcbiAgICAgICAgICAvLyBzZXBhcmF0b3JzIGF0IHRoZSBlbmQgb2YgdGhlIHN0cmluZywgc3RvcCBub3dcbiAgICAgICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICAgICAgc3RhcnRQYXJ0ID0gaSArIDE7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIGlmIChlbmQgPT09IC0xKSB7XG4gICAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCBtYXJrIHRoaXMgYXMgdGhlIGVuZCBvZiBvdXJcbiAgICAgICAgLy8gZXh0ZW5zaW9uXG4gICAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgICAgICBlbmQgPSBpICsgMTtcbiAgICAgIH1cbiAgICAgIGlmIChjb2RlID09PSA0NiAvKi4qLykge1xuICAgICAgICAgIC8vIElmIHRoaXMgaXMgb3VyIGZpcnN0IGRvdCwgbWFyayBpdCBhcyB0aGUgc3RhcnQgb2Ygb3VyIGV4dGVuc2lvblxuICAgICAgICAgIGlmIChzdGFydERvdCA9PT0gLTEpXG4gICAgICAgICAgICBzdGFydERvdCA9IGk7XG4gICAgICAgICAgZWxzZSBpZiAocHJlRG90U3RhdGUgIT09IDEpXG4gICAgICAgICAgICBwcmVEb3RTdGF0ZSA9IDE7XG4gICAgICB9IGVsc2UgaWYgKHN0YXJ0RG90ICE9PSAtMSkge1xuICAgICAgICAvLyBXZSBzYXcgYSBub24tZG90IGFuZCBub24tcGF0aCBzZXBhcmF0b3IgYmVmb3JlIG91ciBkb3QsIHNvIHdlIHNob3VsZFxuICAgICAgICAvLyBoYXZlIGEgZ29vZCBjaGFuY2UgYXQgaGF2aW5nIGEgbm9uLWVtcHR5IGV4dGVuc2lvblxuICAgICAgICBwcmVEb3RTdGF0ZSA9IC0xO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdGFydERvdCA9PT0gLTEgfHwgZW5kID09PSAtMSB8fFxuICAgICAgICAvLyBXZSBzYXcgYSBub24tZG90IGNoYXJhY3RlciBpbW1lZGlhdGVseSBiZWZvcmUgdGhlIGRvdFxuICAgICAgICBwcmVEb3RTdGF0ZSA9PT0gMCB8fFxuICAgICAgICAvLyBUaGUgKHJpZ2h0LW1vc3QpIHRyaW1tZWQgcGF0aCBjb21wb25lbnQgaXMgZXhhY3RseSAnLi4nXG4gICAgICAgIHByZURvdFN0YXRlID09PSAxICYmIHN0YXJ0RG90ID09PSBlbmQgLSAxICYmIHN0YXJ0RG90ID09PSBzdGFydFBhcnQgKyAxKSB7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIHJldHVybiBwYXRoLnNsaWNlKHN0YXJ0RG90LCBlbmQpO1xuICB9LFxuXG4gIGZvcm1hdDogZnVuY3Rpb24gZm9ybWF0KHBhdGhPYmplY3QpIHtcbiAgICBpZiAocGF0aE9iamVjdCA9PT0gbnVsbCB8fCB0eXBlb2YgcGF0aE9iamVjdCAhPT0gJ29iamVjdCcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBcInBhdGhPYmplY3RcIiBhcmd1bWVudCBtdXN0IGJlIG9mIHR5cGUgT2JqZWN0LiBSZWNlaXZlZCB0eXBlICcgKyB0eXBlb2YgcGF0aE9iamVjdCk7XG4gICAgfVxuICAgIHJldHVybiBfZm9ybWF0KCcvJywgcGF0aE9iamVjdCk7XG4gIH0sXG5cbiAgcGFyc2U6IGZ1bmN0aW9uIHBhcnNlKHBhdGgpIHtcbiAgICBhc3NlcnRQYXRoKHBhdGgpO1xuXG4gICAgdmFyIHJldCA9IHsgcm9vdDogJycsIGRpcjogJycsIGJhc2U6ICcnLCBleHQ6ICcnLCBuYW1lOiAnJyB9O1xuICAgIGlmIChwYXRoLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHJldDtcbiAgICB2YXIgY29kZSA9IHBhdGguY2hhckNvZGVBdCgwKTtcbiAgICB2YXIgaXNBYnNvbHV0ZSA9IGNvZGUgPT09IDQ3IC8qLyovO1xuICAgIHZhciBzdGFydDtcbiAgICBpZiAoaXNBYnNvbHV0ZSkge1xuICAgICAgcmV0LnJvb3QgPSAnLyc7XG4gICAgICBzdGFydCA9IDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXJ0ID0gMDtcbiAgICB9XG4gICAgdmFyIHN0YXJ0RG90ID0gLTE7XG4gICAgdmFyIHN0YXJ0UGFydCA9IDA7XG4gICAgdmFyIGVuZCA9IC0xO1xuICAgIHZhciBtYXRjaGVkU2xhc2ggPSB0cnVlO1xuICAgIHZhciBpID0gcGF0aC5sZW5ndGggLSAxO1xuXG4gICAgLy8gVHJhY2sgdGhlIHN0YXRlIG9mIGNoYXJhY3RlcnMgKGlmIGFueSkgd2Ugc2VlIGJlZm9yZSBvdXIgZmlyc3QgZG90IGFuZFxuICAgIC8vIGFmdGVyIGFueSBwYXRoIHNlcGFyYXRvciB3ZSBmaW5kXG4gICAgdmFyIHByZURvdFN0YXRlID0gMDtcblxuICAgIC8vIEdldCBub24tZGlyIGluZm9cbiAgICBmb3IgKDsgaSA+PSBzdGFydDsgLS1pKSB7XG4gICAgICBjb2RlID0gcGF0aC5jaGFyQ29kZUF0KGkpO1xuICAgICAgaWYgKGNvZGUgPT09IDQ3IC8qLyovKSB7XG4gICAgICAgICAgLy8gSWYgd2UgcmVhY2hlZCBhIHBhdGggc2VwYXJhdG9yIHRoYXQgd2FzIG5vdCBwYXJ0IG9mIGEgc2V0IG9mIHBhdGhcbiAgICAgICAgICAvLyBzZXBhcmF0b3JzIGF0IHRoZSBlbmQgb2YgdGhlIHN0cmluZywgc3RvcCBub3dcbiAgICAgICAgICBpZiAoIW1hdGNoZWRTbGFzaCkge1xuICAgICAgICAgICAgc3RhcnRQYXJ0ID0gaSArIDE7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIGlmIChlbmQgPT09IC0xKSB7XG4gICAgICAgIC8vIFdlIHNhdyB0aGUgZmlyc3Qgbm9uLXBhdGggc2VwYXJhdG9yLCBtYXJrIHRoaXMgYXMgdGhlIGVuZCBvZiBvdXJcbiAgICAgICAgLy8gZXh0ZW5zaW9uXG4gICAgICAgIG1hdGNoZWRTbGFzaCA9IGZhbHNlO1xuICAgICAgICBlbmQgPSBpICsgMTtcbiAgICAgIH1cbiAgICAgIGlmIChjb2RlID09PSA0NiAvKi4qLykge1xuICAgICAgICAgIC8vIElmIHRoaXMgaXMgb3VyIGZpcnN0IGRvdCwgbWFyayBpdCBhcyB0aGUgc3RhcnQgb2Ygb3VyIGV4dGVuc2lvblxuICAgICAgICAgIGlmIChzdGFydERvdCA9PT0gLTEpIHN0YXJ0RG90ID0gaTtlbHNlIGlmIChwcmVEb3RTdGF0ZSAhPT0gMSkgcHJlRG90U3RhdGUgPSAxO1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXJ0RG90ICE9PSAtMSkge1xuICAgICAgICAvLyBXZSBzYXcgYSBub24tZG90IGFuZCBub24tcGF0aCBzZXBhcmF0b3IgYmVmb3JlIG91ciBkb3QsIHNvIHdlIHNob3VsZFxuICAgICAgICAvLyBoYXZlIGEgZ29vZCBjaGFuY2UgYXQgaGF2aW5nIGEgbm9uLWVtcHR5IGV4dGVuc2lvblxuICAgICAgICBwcmVEb3RTdGF0ZSA9IC0xO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdGFydERvdCA9PT0gLTEgfHwgZW5kID09PSAtMSB8fFxuICAgIC8vIFdlIHNhdyBhIG5vbi1kb3QgY2hhcmFjdGVyIGltbWVkaWF0ZWx5IGJlZm9yZSB0aGUgZG90XG4gICAgcHJlRG90U3RhdGUgPT09IDAgfHxcbiAgICAvLyBUaGUgKHJpZ2h0LW1vc3QpIHRyaW1tZWQgcGF0aCBjb21wb25lbnQgaXMgZXhhY3RseSAnLi4nXG4gICAgcHJlRG90U3RhdGUgPT09IDEgJiYgc3RhcnREb3QgPT09IGVuZCAtIDEgJiYgc3RhcnREb3QgPT09IHN0YXJ0UGFydCArIDEpIHtcbiAgICAgIGlmIChlbmQgIT09IC0xKSB7XG4gICAgICAgIGlmIChzdGFydFBhcnQgPT09IDAgJiYgaXNBYnNvbHV0ZSkgcmV0LmJhc2UgPSByZXQubmFtZSA9IHBhdGguc2xpY2UoMSwgZW5kKTtlbHNlIHJldC5iYXNlID0gcmV0Lm5hbWUgPSBwYXRoLnNsaWNlKHN0YXJ0UGFydCwgZW5kKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHN0YXJ0UGFydCA9PT0gMCAmJiBpc0Fic29sdXRlKSB7XG4gICAgICAgIHJldC5uYW1lID0gcGF0aC5zbGljZSgxLCBzdGFydERvdCk7XG4gICAgICAgIHJldC5iYXNlID0gcGF0aC5zbGljZSgxLCBlbmQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0Lm5hbWUgPSBwYXRoLnNsaWNlKHN0YXJ0UGFydCwgc3RhcnREb3QpO1xuICAgICAgICByZXQuYmFzZSA9IHBhdGguc2xpY2Uoc3RhcnRQYXJ0LCBlbmQpO1xuICAgICAgfVxuICAgICAgcmV0LmV4dCA9IHBhdGguc2xpY2Uoc3RhcnREb3QsIGVuZCk7XG4gICAgfVxuXG4gICAgaWYgKHN0YXJ0UGFydCA+IDApIHJldC5kaXIgPSBwYXRoLnNsaWNlKDAsIHN0YXJ0UGFydCAtIDEpO2Vsc2UgaWYgKGlzQWJzb2x1dGUpIHJldC5kaXIgPSAnLyc7XG5cbiAgICByZXR1cm4gcmV0O1xuICB9LFxuXG4gIHNlcDogJy8nLFxuICBkZWxpbWl0ZXI6ICc6JyxcbiAgd2luMzI6IG51bGwsXG4gIHBvc2l4OiBudWxsXG59O1xuXG5wb3NpeC5wb3NpeCA9IHBvc2l4O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHBvc2l4O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBpc2V4ZVxuaXNleGUuc3luYyA9IHN5bmNcblxudmFyIGZzID0gcmVxdWlyZSgnZnMnKVxuXG5mdW5jdGlvbiBjaGVja1BhdGhFeHQgKHBhdGgsIG9wdGlvbnMpIHtcbiAgdmFyIHBhdGhleHQgPSBvcHRpb25zLnBhdGhFeHQgIT09IHVuZGVmaW5lZCA/XG4gICAgb3B0aW9ucy5wYXRoRXh0IDogcHJvY2Vzcy5lbnYuUEFUSEVYVFxuXG4gIGlmICghcGF0aGV4dCkge1xuICAgIHJldHVybiB0cnVlXG4gIH1cblxuICBwYXRoZXh0ID0gcGF0aGV4dC5zcGxpdCgnOycpXG4gIGlmIChwYXRoZXh0LmluZGV4T2YoJycpICE9PSAtMSkge1xuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXRoZXh0Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHAgPSBwYXRoZXh0W2ldLnRvTG93ZXJDYXNlKClcbiAgICBpZiAocCAmJiBwYXRoLnN1YnN0cigtcC5sZW5ndGgpLnRvTG93ZXJDYXNlKCkgPT09IHApIHtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICB9XG4gIHJldHVybiBmYWxzZVxufVxuXG5mdW5jdGlvbiBjaGVja1N0YXQgKHN0YXQsIHBhdGgsIG9wdGlvbnMpIHtcbiAgaWYgKCFzdGF0LmlzU3ltYm9saWNMaW5rKCkgJiYgIXN0YXQuaXNGaWxlKCkpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICByZXR1cm4gY2hlY2tQYXRoRXh0KHBhdGgsIG9wdGlvbnMpXG59XG5cbmZ1bmN0aW9uIGlzZXhlIChwYXRoLCBvcHRpb25zLCBjYikge1xuICBmcy5zdGF0KHBhdGgsIGZ1bmN0aW9uIChlciwgc3RhdCkge1xuICAgIGNiKGVyLCBlciA/IGZhbHNlIDogY2hlY2tTdGF0KHN0YXQsIHBhdGgsIG9wdGlvbnMpKVxuICB9KVxufVxuXG5mdW5jdGlvbiBzeW5jIChwYXRoLCBvcHRpb25zKSB7XG4gIHJldHVybiBjaGVja1N0YXQoZnMuc3RhdFN5bmMocGF0aCksIHBhdGgsIG9wdGlvbnMpXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGlzZXhlXG5pc2V4ZS5zeW5jID0gc3luY1xuXG52YXIgZnMgPSByZXF1aXJlKCdmcycpXG5cbmZ1bmN0aW9uIGlzZXhlIChwYXRoLCBvcHRpb25zLCBjYikge1xuICBmcy5zdGF0KHBhdGgsIGZ1bmN0aW9uIChlciwgc3RhdCkge1xuICAgIGNiKGVyLCBlciA/IGZhbHNlIDogY2hlY2tTdGF0KHN0YXQsIG9wdGlvbnMpKVxuICB9KVxufVxuXG5mdW5jdGlvbiBzeW5jIChwYXRoLCBvcHRpb25zKSB7XG4gIHJldHVybiBjaGVja1N0YXQoZnMuc3RhdFN5bmMocGF0aCksIG9wdGlvbnMpXG59XG5cbmZ1bmN0aW9uIGNoZWNrU3RhdCAoc3RhdCwgb3B0aW9ucykge1xuICByZXR1cm4gc3RhdC5pc0ZpbGUoKSAmJiBjaGVja01vZGUoc3RhdCwgb3B0aW9ucylcbn1cblxuZnVuY3Rpb24gY2hlY2tNb2RlIChzdGF0LCBvcHRpb25zKSB7XG4gIHZhciBtb2QgPSBzdGF0Lm1vZGVcbiAgdmFyIHVpZCA9IHN0YXQudWlkXG4gIHZhciBnaWQgPSBzdGF0LmdpZFxuXG4gIHZhciBteVVpZCA9IG9wdGlvbnMudWlkICE9PSB1bmRlZmluZWQgP1xuICAgIG9wdGlvbnMudWlkIDogcHJvY2Vzcy5nZXR1aWQgJiYgcHJvY2Vzcy5nZXR1aWQoKVxuICB2YXIgbXlHaWQgPSBvcHRpb25zLmdpZCAhPT0gdW5kZWZpbmVkID9cbiAgICBvcHRpb25zLmdpZCA6IHByb2Nlc3MuZ2V0Z2lkICYmIHByb2Nlc3MuZ2V0Z2lkKClcblxuICB2YXIgdSA9IHBhcnNlSW50KCcxMDAnLCA4KVxuICB2YXIgZyA9IHBhcnNlSW50KCcwMTAnLCA4KVxuICB2YXIgbyA9IHBhcnNlSW50KCcwMDEnLCA4KVxuICB2YXIgdWcgPSB1IHwgZ1xuXG4gIHZhciByZXQgPSAobW9kICYgbykgfHxcbiAgICAobW9kICYgZykgJiYgZ2lkID09PSBteUdpZCB8fFxuICAgIChtb2QgJiB1KSAmJiB1aWQgPT09IG15VWlkIHx8XG4gICAgKG1vZCAmIHVnKSAmJiBteVVpZCA9PT0gMFxuXG4gIHJldHVybiByZXRcbn1cbiIsInZhciBmcyA9IHJlcXVpcmUoJ2ZzJylcbnZhciBjb3JlXG5pZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJyB8fCBnbG9iYWwuVEVTVElOR19XSU5ET1dTKSB7XG4gIGNvcmUgPSByZXF1aXJlKCcuL3dpbmRvd3MuanMnKVxufSBlbHNlIHtcbiAgY29yZSA9IHJlcXVpcmUoJy4vbW9kZS5qcycpXG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNleGVcbmlzZXhlLnN5bmMgPSBzeW5jXG5cbmZ1bmN0aW9uIGlzZXhlIChwYXRoLCBvcHRpb25zLCBjYikge1xuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjYiA9IG9wdGlvbnNcbiAgICBvcHRpb25zID0ge31cbiAgfVxuXG4gIGlmICghY2IpIHtcbiAgICBpZiAodHlwZW9mIFByb21pc2UgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NhbGxiYWNrIG5vdCBwcm92aWRlZCcpXG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIGlzZXhlKHBhdGgsIG9wdGlvbnMgfHwge30sIGZ1bmN0aW9uIChlciwgaXMpIHtcbiAgICAgICAgaWYgKGVyKSB7XG4gICAgICAgICAgcmVqZWN0KGVyKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc29sdmUoaXMpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSlcbiAgfVxuXG4gIGNvcmUocGF0aCwgb3B0aW9ucyB8fCB7fSwgZnVuY3Rpb24gKGVyLCBpcykge1xuICAgIC8vIGlnbm9yZSBFQUNDRVMgYmVjYXVzZSB0aGF0IGp1c3QgbWVhbnMgd2UgYXJlbid0IGFsbG93ZWQgdG8gcnVuIGl0XG4gICAgaWYgKGVyKSB7XG4gICAgICBpZiAoZXIuY29kZSA9PT0gJ0VBQ0NFUycgfHwgb3B0aW9ucyAmJiBvcHRpb25zLmlnbm9yZUVycm9ycykge1xuICAgICAgICBlciA9IG51bGxcbiAgICAgICAgaXMgPSBmYWxzZVxuICAgICAgfVxuICAgIH1cbiAgICBjYihlciwgaXMpXG4gIH0pXG59XG5cbmZ1bmN0aW9uIHN5bmMgKHBhdGgsIG9wdGlvbnMpIHtcbiAgLy8gbXkga2luZ2RvbSBmb3IgYSBmaWx0ZXJlZCBjYXRjaFxuICB0cnkge1xuICAgIHJldHVybiBjb3JlLnN5bmMocGF0aCwgb3B0aW9ucyB8fCB7fSlcbiAgfSBjYXRjaCAoZXIpIHtcbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLmlnbm9yZUVycm9ycyB8fCBlci5jb2RlID09PSAnRUFDQ0VTJykge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IGVyXG4gICAgfVxuICB9XG59XG4iLCJjb25zdCBpc1dpbmRvd3MgPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInIHx8XG4gICAgcHJvY2Vzcy5lbnYuT1NUWVBFID09PSAnY3lnd2luJyB8fFxuICAgIHByb2Nlc3MuZW52Lk9TVFlQRSA9PT0gJ21zeXMnXG5cbmNvbnN0IHBhdGggPSByZXF1aXJlKCdwYXRoJylcbmNvbnN0IENPTE9OID0gaXNXaW5kb3dzID8gJzsnIDogJzonXG5jb25zdCBpc2V4ZSA9IHJlcXVpcmUoJ2lzZXhlJylcblxuY29uc3QgZ2V0Tm90Rm91bmRFcnJvciA9IChjbWQpID0+XG4gIE9iamVjdC5hc3NpZ24obmV3IEVycm9yKGBub3QgZm91bmQ6ICR7Y21kfWApLCB7IGNvZGU6ICdFTk9FTlQnIH0pXG5cbmNvbnN0IGdldFBhdGhJbmZvID0gKGNtZCwgb3B0KSA9PiB7XG4gIGNvbnN0IGNvbG9uID0gb3B0LmNvbG9uIHx8IENPTE9OXG5cbiAgLy8gSWYgaXQgaGFzIGEgc2xhc2gsIHRoZW4gd2UgZG9uJ3QgYm90aGVyIHNlYXJjaGluZyB0aGUgcGF0aGVudi5cbiAgLy8ganVzdCBjaGVjayB0aGUgZmlsZSBpdHNlbGYsIGFuZCB0aGF0J3MgaXQuXG4gIGNvbnN0IHBhdGhFbnYgPSBjbWQubWF0Y2goL1xcLy8pIHx8IGlzV2luZG93cyAmJiBjbWQubWF0Y2goL1xcXFwvKSA/IFsnJ11cbiAgICA6IChcbiAgICAgIFtcbiAgICAgICAgLy8gd2luZG93cyBhbHdheXMgY2hlY2tzIHRoZSBjd2QgZmlyc3RcbiAgICAgICAgLi4uKGlzV2luZG93cyA/IFtwcm9jZXNzLmN3ZCgpXSA6IFtdKSxcbiAgICAgICAgLi4uKG9wdC5wYXRoIHx8IHByb2Nlc3MuZW52LlBBVEggfHxcbiAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dDogdmVyeSB1bnVzdWFsICovICcnKS5zcGxpdChjb2xvbiksXG4gICAgICBdXG4gICAgKVxuICBjb25zdCBwYXRoRXh0RXhlID0gaXNXaW5kb3dzXG4gICAgPyBvcHQucGF0aEV4dCB8fCBwcm9jZXNzLmVudi5QQVRIRVhUIHx8ICcuRVhFOy5DTUQ7LkJBVDsuQ09NJ1xuICAgIDogJydcbiAgY29uc3QgcGF0aEV4dCA9IGlzV2luZG93cyA/IHBhdGhFeHRFeGUuc3BsaXQoY29sb24pIDogWycnXVxuXG4gIGlmIChpc1dpbmRvd3MpIHtcbiAgICBpZiAoY21kLmluZGV4T2YoJy4nKSAhPT0gLTEgJiYgcGF0aEV4dFswXSAhPT0gJycpXG4gICAgICBwYXRoRXh0LnVuc2hpZnQoJycpXG4gIH1cblxuICByZXR1cm4ge1xuICAgIHBhdGhFbnYsXG4gICAgcGF0aEV4dCxcbiAgICBwYXRoRXh0RXhlLFxuICB9XG59XG5cbmNvbnN0IHdoaWNoID0gKGNtZCwgb3B0LCBjYikgPT4ge1xuICBpZiAodHlwZW9mIG9wdCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNiID0gb3B0XG4gICAgb3B0ID0ge31cbiAgfVxuICBpZiAoIW9wdClcbiAgICBvcHQgPSB7fVxuXG4gIGNvbnN0IHsgcGF0aEVudiwgcGF0aEV4dCwgcGF0aEV4dEV4ZSB9ID0gZ2V0UGF0aEluZm8oY21kLCBvcHQpXG4gIGNvbnN0IGZvdW5kID0gW11cblxuICBjb25zdCBzdGVwID0gaSA9PiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgaWYgKGkgPT09IHBhdGhFbnYubGVuZ3RoKVxuICAgICAgcmV0dXJuIG9wdC5hbGwgJiYgZm91bmQubGVuZ3RoID8gcmVzb2x2ZShmb3VuZClcbiAgICAgICAgOiByZWplY3QoZ2V0Tm90Rm91bmRFcnJvcihjbWQpKVxuXG4gICAgY29uc3QgcHBSYXcgPSBwYXRoRW52W2ldXG4gICAgY29uc3QgcGF0aFBhcnQgPSAvXlwiLipcIiQvLnRlc3QocHBSYXcpID8gcHBSYXcuc2xpY2UoMSwgLTEpIDogcHBSYXdcblxuICAgIGNvbnN0IHBDbWQgPSBwYXRoLmpvaW4ocGF0aFBhcnQsIGNtZClcbiAgICBjb25zdCBwID0gIXBhdGhQYXJ0ICYmIC9eXFwuW1xcXFxcXC9dLy50ZXN0KGNtZCkgPyBjbWQuc2xpY2UoMCwgMikgKyBwQ21kXG4gICAgICA6IHBDbWRcblxuICAgIHJlc29sdmUoc3ViU3RlcChwLCBpLCAwKSlcbiAgfSlcblxuICBjb25zdCBzdWJTdGVwID0gKHAsIGksIGlpKSA9PiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgaWYgKGlpID09PSBwYXRoRXh0Lmxlbmd0aClcbiAgICAgIHJldHVybiByZXNvbHZlKHN0ZXAoaSArIDEpKVxuICAgIGNvbnN0IGV4dCA9IHBhdGhFeHRbaWldXG4gICAgaXNleGUocCArIGV4dCwgeyBwYXRoRXh0OiBwYXRoRXh0RXhlIH0sIChlciwgaXMpID0+IHtcbiAgICAgIGlmICghZXIgJiYgaXMpIHtcbiAgICAgICAgaWYgKG9wdC5hbGwpXG4gICAgICAgICAgZm91bmQucHVzaChwICsgZXh0KVxuICAgICAgICBlbHNlXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUocCArIGV4dClcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXNvbHZlKHN1YlN0ZXAocCwgaSwgaWkgKyAxKSlcbiAgICB9KVxuICB9KVxuXG4gIHJldHVybiBjYiA/IHN0ZXAoMCkudGhlbihyZXMgPT4gY2IobnVsbCwgcmVzKSwgY2IpIDogc3RlcCgwKVxufVxuXG5jb25zdCB3aGljaFN5bmMgPSAoY21kLCBvcHQpID0+IHtcbiAgb3B0ID0gb3B0IHx8IHt9XG5cbiAgY29uc3QgeyBwYXRoRW52LCBwYXRoRXh0LCBwYXRoRXh0RXhlIH0gPSBnZXRQYXRoSW5mbyhjbWQsIG9wdClcbiAgY29uc3QgZm91bmQgPSBbXVxuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0aEVudi5sZW5ndGg7IGkgKyspIHtcbiAgICBjb25zdCBwcFJhdyA9IHBhdGhFbnZbaV1cbiAgICBjb25zdCBwYXRoUGFydCA9IC9eXCIuKlwiJC8udGVzdChwcFJhdykgPyBwcFJhdy5zbGljZSgxLCAtMSkgOiBwcFJhd1xuXG4gICAgY29uc3QgcENtZCA9IHBhdGguam9pbihwYXRoUGFydCwgY21kKVxuICAgIGNvbnN0IHAgPSAhcGF0aFBhcnQgJiYgL15cXC5bXFxcXFxcL10vLnRlc3QoY21kKSA/IGNtZC5zbGljZSgwLCAyKSArIHBDbWRcbiAgICAgIDogcENtZFxuXG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBwYXRoRXh0Lmxlbmd0aDsgaiArKykge1xuICAgICAgY29uc3QgY3VyID0gcCArIHBhdGhFeHRbal1cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGlzID0gaXNleGUuc3luYyhjdXIsIHsgcGF0aEV4dDogcGF0aEV4dEV4ZSB9KVxuICAgICAgICBpZiAoaXMpIHtcbiAgICAgICAgICBpZiAob3B0LmFsbClcbiAgICAgICAgICAgIGZvdW5kLnB1c2goY3VyKVxuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJldHVybiBjdXJcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXgpIHt9XG4gICAgfVxuICB9XG5cbiAgaWYgKG9wdC5hbGwgJiYgZm91bmQubGVuZ3RoKVxuICAgIHJldHVybiBmb3VuZFxuXG4gIGlmIChvcHQubm90aHJvdylcbiAgICByZXR1cm4gbnVsbFxuXG4gIHRocm93IGdldE5vdEZvdW5kRXJyb3IoY21kKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHdoaWNoXG53aGljaC5zeW5jID0gd2hpY2hTeW5jXG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IHBhdGhLZXkgPSAob3B0aW9ucyA9IHt9KSA9PiB7XG5cdGNvbnN0IGVudmlyb25tZW50ID0gb3B0aW9ucy5lbnYgfHwgcHJvY2Vzcy5lbnY7XG5cdGNvbnN0IHBsYXRmb3JtID0gb3B0aW9ucy5wbGF0Zm9ybSB8fCBwcm9jZXNzLnBsYXRmb3JtO1xuXG5cdGlmIChwbGF0Zm9ybSAhPT0gJ3dpbjMyJykge1xuXHRcdHJldHVybiAnUEFUSCc7XG5cdH1cblxuXHRyZXR1cm4gT2JqZWN0LmtleXMoZW52aXJvbm1lbnQpLnJldmVyc2UoKS5maW5kKGtleSA9PiBrZXkudG9VcHBlckNhc2UoKSA9PT0gJ1BBVEgnKSB8fCAnUGF0aCc7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHBhdGhLZXk7XG4vLyBUT0RPOiBSZW1vdmUgdGhpcyBmb3IgdGhlIG5leHQgbWFqb3IgcmVsZWFzZVxubW9kdWxlLmV4cG9ydHMuZGVmYXVsdCA9IHBhdGhLZXk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IHBhdGggPSByZXF1aXJlKCdwYXRoJyk7XG5jb25zdCB3aGljaCA9IHJlcXVpcmUoJ3doaWNoJyk7XG5jb25zdCBnZXRQYXRoS2V5ID0gcmVxdWlyZSgncGF0aC1rZXknKTtcblxuZnVuY3Rpb24gcmVzb2x2ZUNvbW1hbmRBdHRlbXB0KHBhcnNlZCwgd2l0aG91dFBhdGhFeHQpIHtcbiAgICBjb25zdCBlbnYgPSBwYXJzZWQub3B0aW9ucy5lbnYgfHwgcHJvY2Vzcy5lbnY7XG4gICAgY29uc3QgY3dkID0gcHJvY2Vzcy5jd2QoKTtcbiAgICBjb25zdCBoYXNDdXN0b21Dd2QgPSBwYXJzZWQub3B0aW9ucy5jd2QgIT0gbnVsbDtcbiAgICAvLyBXb3JrZXIgdGhyZWFkcyBkbyBub3QgaGF2ZSBwcm9jZXNzLmNoZGlyKClcbiAgICBjb25zdCBzaG91bGRTd2l0Y2hDd2QgPSBoYXNDdXN0b21Dd2QgJiYgcHJvY2Vzcy5jaGRpciAhPT0gdW5kZWZpbmVkICYmICFwcm9jZXNzLmNoZGlyLmRpc2FibGVkO1xuXG4gICAgLy8gSWYgYSBjdXN0b20gYGN3ZGAgd2FzIHNwZWNpZmllZCwgd2UgbmVlZCB0byBjaGFuZ2UgdGhlIHByb2Nlc3MgY3dkXG4gICAgLy8gYmVjYXVzZSBgd2hpY2hgIHdpbGwgZG8gc3RhdCBjYWxscyBidXQgZG9lcyBub3Qgc3VwcG9ydCBhIGN1c3RvbSBjd2RcbiAgICBpZiAoc2hvdWxkU3dpdGNoQ3dkKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBwcm9jZXNzLmNoZGlyKHBhcnNlZC5vcHRpb25zLmN3ZCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgLyogRW1wdHkgKi9cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxldCByZXNvbHZlZDtcblxuICAgIHRyeSB7XG4gICAgICAgIHJlc29sdmVkID0gd2hpY2guc3luYyhwYXJzZWQuY29tbWFuZCwge1xuICAgICAgICAgICAgcGF0aDogZW52W2dldFBhdGhLZXkoeyBlbnYgfSldLFxuICAgICAgICAgICAgcGF0aEV4dDogd2l0aG91dFBhdGhFeHQgPyBwYXRoLmRlbGltaXRlciA6IHVuZGVmaW5lZCxcbiAgICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvKiBFbXB0eSAqL1xuICAgIH0gZmluYWxseSB7XG4gICAgICAgIGlmIChzaG91bGRTd2l0Y2hDd2QpIHtcbiAgICAgICAgICAgIHByb2Nlc3MuY2hkaXIoY3dkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIElmIHdlIHN1Y2Nlc3NmdWxseSByZXNvbHZlZCwgZW5zdXJlIHRoYXQgYW4gYWJzb2x1dGUgcGF0aCBpcyByZXR1cm5lZFxuICAgIC8vIE5vdGUgdGhhdCB3aGVuIGEgY3VzdG9tIGBjd2RgIHdhcyB1c2VkLCB3ZSBuZWVkIHRvIHJlc29sdmUgdG8gYW4gYWJzb2x1dGUgcGF0aCBiYXNlZCBvbiBpdFxuICAgIGlmIChyZXNvbHZlZCkge1xuICAgICAgICByZXNvbHZlZCA9IHBhdGgucmVzb2x2ZShoYXNDdXN0b21Dd2QgPyBwYXJzZWQub3B0aW9ucy5jd2QgOiAnJywgcmVzb2x2ZWQpO1xuICAgIH1cblxuICAgIHJldHVybiByZXNvbHZlZDtcbn1cblxuZnVuY3Rpb24gcmVzb2x2ZUNvbW1hbmQocGFyc2VkKSB7XG4gICAgcmV0dXJuIHJlc29sdmVDb21tYW5kQXR0ZW1wdChwYXJzZWQpIHx8IHJlc29sdmVDb21tYW5kQXR0ZW1wdChwYXJzZWQsIHRydWUpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlc29sdmVDb21tYW5kO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBTZWUgaHR0cDovL3d3dy5yb2J2YW5kZXJ3b3VkZS5jb20vZXNjYXBlY2hhcnMucGhwXG5jb25zdCBtZXRhQ2hhcnNSZWdFeHAgPSAvKFsoKVxcXVslIV5cImA8PiZ8OywgKj9dKS9nO1xuXG5mdW5jdGlvbiBlc2NhcGVDb21tYW5kKGFyZykge1xuICAgIC8vIEVzY2FwZSBtZXRhIGNoYXJzXG4gICAgYXJnID0gYXJnLnJlcGxhY2UobWV0YUNoYXJzUmVnRXhwLCAnXiQxJyk7XG5cbiAgICByZXR1cm4gYXJnO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVBcmd1bWVudChhcmcsIGRvdWJsZUVzY2FwZU1ldGFDaGFycykge1xuICAgIC8vIENvbnZlcnQgdG8gc3RyaW5nXG4gICAgYXJnID0gYCR7YXJnfWA7XG5cbiAgICAvLyBBbGdvcml0aG0gYmVsb3cgaXMgYmFzZWQgb24gaHR0cHM6Ly9xbnRtLm9yZy9jbWRcblxuICAgIC8vIFNlcXVlbmNlIG9mIGJhY2tzbGFzaGVzIGZvbGxvd2VkIGJ5IGEgZG91YmxlIHF1b3RlOlxuICAgIC8vIGRvdWJsZSB1cCBhbGwgdGhlIGJhY2tzbGFzaGVzIGFuZCBlc2NhcGUgdGhlIGRvdWJsZSBxdW90ZVxuICAgIGFyZyA9IGFyZy5yZXBsYWNlKC8oXFxcXCopXCIvZywgJyQxJDFcXFxcXCInKTtcblxuICAgIC8vIFNlcXVlbmNlIG9mIGJhY2tzbGFzaGVzIGZvbGxvd2VkIGJ5IHRoZSBlbmQgb2YgdGhlIHN0cmluZ1xuICAgIC8vICh3aGljaCB3aWxsIGJlY29tZSBhIGRvdWJsZSBxdW90ZSBsYXRlcik6XG4gICAgLy8gZG91YmxlIHVwIGFsbCB0aGUgYmFja3NsYXNoZXNcbiAgICBhcmcgPSBhcmcucmVwbGFjZSgvKFxcXFwqKSQvLCAnJDEkMScpO1xuXG4gICAgLy8gQWxsIG90aGVyIGJhY2tzbGFzaGVzIG9jY3VyIGxpdGVyYWxseVxuXG4gICAgLy8gUXVvdGUgdGhlIHdob2xlIHRoaW5nOlxuICAgIGFyZyA9IGBcIiR7YXJnfVwiYDtcblxuICAgIC8vIEVzY2FwZSBtZXRhIGNoYXJzXG4gICAgYXJnID0gYXJnLnJlcGxhY2UobWV0YUNoYXJzUmVnRXhwLCAnXiQxJyk7XG5cbiAgICAvLyBEb3VibGUgZXNjYXBlIG1ldGEgY2hhcnMgaWYgbmVjZXNzYXJ5XG4gICAgaWYgKGRvdWJsZUVzY2FwZU1ldGFDaGFycykge1xuICAgICAgICBhcmcgPSBhcmcucmVwbGFjZShtZXRhQ2hhcnNSZWdFeHAsICdeJDEnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXJnO1xufVxuXG5tb2R1bGUuZXhwb3J0cy5jb21tYW5kID0gZXNjYXBlQ29tbWFuZDtcbm1vZHVsZS5leHBvcnRzLmFyZ3VtZW50ID0gZXNjYXBlQXJndW1lbnQ7XG4iLCIndXNlIHN0cmljdCc7XG5tb2R1bGUuZXhwb3J0cyA9IC9eIyEoLiopLztcbiIsIid1c2Ugc3RyaWN0JztcbmNvbnN0IHNoZWJhbmdSZWdleCA9IHJlcXVpcmUoJ3NoZWJhbmctcmVnZXgnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoc3RyaW5nID0gJycpID0+IHtcblx0Y29uc3QgbWF0Y2ggPSBzdHJpbmcubWF0Y2goc2hlYmFuZ1JlZ2V4KTtcblxuXHRpZiAoIW1hdGNoKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjb25zdCBbcGF0aCwgYXJndW1lbnRdID0gbWF0Y2hbMF0ucmVwbGFjZSgvIyEgPy8sICcnKS5zcGxpdCgnICcpO1xuXHRjb25zdCBiaW5hcnkgPSBwYXRoLnNwbGl0KCcvJykucG9wKCk7XG5cblx0aWYgKGJpbmFyeSA9PT0gJ2VudicpIHtcblx0XHRyZXR1cm4gYXJndW1lbnQ7XG5cdH1cblxuXHRyZXR1cm4gYXJndW1lbnQgPyBgJHtiaW5hcnl9ICR7YXJndW1lbnR9YCA6IGJpbmFyeTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGZzID0gcmVxdWlyZSgnZnMnKTtcbmNvbnN0IHNoZWJhbmdDb21tYW5kID0gcmVxdWlyZSgnc2hlYmFuZy1jb21tYW5kJyk7XG5cbmZ1bmN0aW9uIHJlYWRTaGViYW5nKGNvbW1hbmQpIHtcbiAgICAvLyBSZWFkIHRoZSBmaXJzdCAxNTAgYnl0ZXMgZnJvbSB0aGUgZmlsZVxuICAgIGNvbnN0IHNpemUgPSAxNTA7XG4gICAgY29uc3QgYnVmZmVyID0gQnVmZmVyLmFsbG9jKHNpemUpO1xuXG4gICAgbGV0IGZkO1xuXG4gICAgdHJ5IHtcbiAgICAgICAgZmQgPSBmcy5vcGVuU3luYyhjb21tYW5kLCAncicpO1xuICAgICAgICBmcy5yZWFkU3luYyhmZCwgYnVmZmVyLCAwLCBzaXplLCAwKTtcbiAgICAgICAgZnMuY2xvc2VTeW5jKGZkKTtcbiAgICB9IGNhdGNoIChlKSB7IC8qIEVtcHR5ICovIH1cblxuICAgIC8vIEF0dGVtcHQgdG8gZXh0cmFjdCBzaGViYW5nIChudWxsIGlzIHJldHVybmVkIGlmIG5vdCBhIHNoZWJhbmcpXG4gICAgcmV0dXJuIHNoZWJhbmdDb21tYW5kKGJ1ZmZlci50b1N0cmluZygpKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSByZWFkU2hlYmFuZztcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKTtcbmNvbnN0IHJlc29sdmVDb21tYW5kID0gcmVxdWlyZSgnLi91dGlsL3Jlc29sdmVDb21tYW5kJyk7XG5jb25zdCBlc2NhcGUgPSByZXF1aXJlKCcuL3V0aWwvZXNjYXBlJyk7XG5jb25zdCByZWFkU2hlYmFuZyA9IHJlcXVpcmUoJy4vdXRpbC9yZWFkU2hlYmFuZycpO1xuXG5jb25zdCBpc1dpbiA9IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMic7XG5jb25zdCBpc0V4ZWN1dGFibGVSZWdFeHAgPSAvXFwuKD86Y29tfGV4ZSkkL2k7XG5jb25zdCBpc0NtZFNoaW1SZWdFeHAgPSAvbm9kZV9tb2R1bGVzW1xcXFwvXS5iaW5bXFxcXC9dW15cXFxcL10rXFwuY21kJC9pO1xuXG5mdW5jdGlvbiBkZXRlY3RTaGViYW5nKHBhcnNlZCkge1xuICAgIHBhcnNlZC5maWxlID0gcmVzb2x2ZUNvbW1hbmQocGFyc2VkKTtcblxuICAgIGNvbnN0IHNoZWJhbmcgPSBwYXJzZWQuZmlsZSAmJiByZWFkU2hlYmFuZyhwYXJzZWQuZmlsZSk7XG5cbiAgICBpZiAoc2hlYmFuZykge1xuICAgICAgICBwYXJzZWQuYXJncy51bnNoaWZ0KHBhcnNlZC5maWxlKTtcbiAgICAgICAgcGFyc2VkLmNvbW1hbmQgPSBzaGViYW5nO1xuXG4gICAgICAgIHJldHVybiByZXNvbHZlQ29tbWFuZChwYXJzZWQpO1xuICAgIH1cblxuICAgIHJldHVybiBwYXJzZWQuZmlsZTtcbn1cblxuZnVuY3Rpb24gcGFyc2VOb25TaGVsbChwYXJzZWQpIHtcbiAgICBpZiAoIWlzV2luKSB7XG4gICAgICAgIHJldHVybiBwYXJzZWQ7XG4gICAgfVxuXG4gICAgLy8gRGV0ZWN0ICYgYWRkIHN1cHBvcnQgZm9yIHNoZWJhbmdzXG4gICAgY29uc3QgY29tbWFuZEZpbGUgPSBkZXRlY3RTaGViYW5nKHBhcnNlZCk7XG5cbiAgICAvLyBXZSBkb24ndCBuZWVkIGEgc2hlbGwgaWYgdGhlIGNvbW1hbmQgZmlsZW5hbWUgaXMgYW4gZXhlY3V0YWJsZVxuICAgIGNvbnN0IG5lZWRzU2hlbGwgPSAhaXNFeGVjdXRhYmxlUmVnRXhwLnRlc3QoY29tbWFuZEZpbGUpO1xuXG4gICAgLy8gSWYgYSBzaGVsbCBpcyByZXF1aXJlZCwgdXNlIGNtZC5leGUgYW5kIHRha2UgY2FyZSBvZiBlc2NhcGluZyBldmVyeXRoaW5nIGNvcnJlY3RseVxuICAgIC8vIE5vdGUgdGhhdCBgZm9yY2VTaGVsbGAgaXMgYW4gaGlkZGVuIG9wdGlvbiB1c2VkIG9ubHkgaW4gdGVzdHNcbiAgICBpZiAocGFyc2VkLm9wdGlvbnMuZm9yY2VTaGVsbCB8fCBuZWVkc1NoZWxsKSB7XG4gICAgICAgIC8vIE5lZWQgdG8gZG91YmxlIGVzY2FwZSBtZXRhIGNoYXJzIGlmIHRoZSBjb21tYW5kIGlzIGEgY21kLXNoaW0gbG9jYXRlZCBpbiBgbm9kZV9tb2R1bGVzLy5iaW4vYFxuICAgICAgICAvLyBUaGUgY21kLXNoaW0gc2ltcGx5IGNhbGxzIGV4ZWN1dGUgdGhlIHBhY2thZ2UgYmluIGZpbGUgd2l0aCBOb2RlSlMsIHByb3h5aW5nIGFueSBhcmd1bWVudFxuICAgICAgICAvLyBCZWNhdXNlIHRoZSBlc2NhcGUgb2YgbWV0YWNoYXJzIHdpdGggXiBnZXRzIGludGVycHJldGVkIHdoZW4gdGhlIGNtZC5leGUgaXMgZmlyc3QgY2FsbGVkLFxuICAgICAgICAvLyB3ZSBuZWVkIHRvIGRvdWJsZSBlc2NhcGUgdGhlbVxuICAgICAgICBjb25zdCBuZWVkc0RvdWJsZUVzY2FwZU1ldGFDaGFycyA9IGlzQ21kU2hpbVJlZ0V4cC50ZXN0KGNvbW1hbmRGaWxlKTtcblxuICAgICAgICAvLyBOb3JtYWxpemUgcG9zaXggcGF0aHMgaW50byBPUyBjb21wYXRpYmxlIHBhdGhzIChlLmcuOiBmb28vYmFyIC0+IGZvb1xcYmFyKVxuICAgICAgICAvLyBUaGlzIGlzIG5lY2Vzc2FyeSBvdGhlcndpc2UgaXQgd2lsbCBhbHdheXMgZmFpbCB3aXRoIEVOT0VOVCBpbiB0aG9zZSBjYXNlc1xuICAgICAgICBwYXJzZWQuY29tbWFuZCA9IHBhdGgubm9ybWFsaXplKHBhcnNlZC5jb21tYW5kKTtcblxuICAgICAgICAvLyBFc2NhcGUgY29tbWFuZCAmIGFyZ3VtZW50c1xuICAgICAgICBwYXJzZWQuY29tbWFuZCA9IGVzY2FwZS5jb21tYW5kKHBhcnNlZC5jb21tYW5kKTtcbiAgICAgICAgcGFyc2VkLmFyZ3MgPSBwYXJzZWQuYXJncy5tYXAoKGFyZykgPT4gZXNjYXBlLmFyZ3VtZW50KGFyZywgbmVlZHNEb3VibGVFc2NhcGVNZXRhQ2hhcnMpKTtcblxuICAgICAgICBjb25zdCBzaGVsbENvbW1hbmQgPSBbcGFyc2VkLmNvbW1hbmRdLmNvbmNhdChwYXJzZWQuYXJncykuam9pbignICcpO1xuXG4gICAgICAgIHBhcnNlZC5hcmdzID0gWycvZCcsICcvcycsICcvYycsIGBcIiR7c2hlbGxDb21tYW5kfVwiYF07XG4gICAgICAgIHBhcnNlZC5jb21tYW5kID0gcHJvY2Vzcy5lbnYuY29tc3BlYyB8fCAnY21kLmV4ZSc7XG4gICAgICAgIHBhcnNlZC5vcHRpb25zLndpbmRvd3NWZXJiYXRpbUFyZ3VtZW50cyA9IHRydWU7IC8vIFRlbGwgbm9kZSdzIHNwYXduIHRoYXQgdGhlIGFyZ3VtZW50cyBhcmUgYWxyZWFkeSBlc2NhcGVkXG4gICAgfVxuXG4gICAgcmV0dXJuIHBhcnNlZDtcbn1cblxuZnVuY3Rpb24gcGFyc2UoY29tbWFuZCwgYXJncywgb3B0aW9ucykge1xuICAgIC8vIE5vcm1hbGl6ZSBhcmd1bWVudHMsIHNpbWlsYXIgdG8gbm9kZWpzXG4gICAgaWYgKGFyZ3MgJiYgIUFycmF5LmlzQXJyYXkoYXJncykpIHtcbiAgICAgICAgb3B0aW9ucyA9IGFyZ3M7XG4gICAgICAgIGFyZ3MgPSBudWxsO1xuICAgIH1cblxuICAgIGFyZ3MgPSBhcmdzID8gYXJncy5zbGljZSgwKSA6IFtdOyAvLyBDbG9uZSBhcnJheSB0byBhdm9pZCBjaGFuZ2luZyB0aGUgb3JpZ2luYWxcbiAgICBvcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucyk7IC8vIENsb25lIG9iamVjdCB0byBhdm9pZCBjaGFuZ2luZyB0aGUgb3JpZ2luYWxcblxuICAgIC8vIEJ1aWxkIG91ciBwYXJzZWQgb2JqZWN0XG4gICAgY29uc3QgcGFyc2VkID0ge1xuICAgICAgICBjb21tYW5kLFxuICAgICAgICBhcmdzLFxuICAgICAgICBvcHRpb25zLFxuICAgICAgICBmaWxlOiB1bmRlZmluZWQsXG4gICAgICAgIG9yaWdpbmFsOiB7XG4gICAgICAgICAgICBjb21tYW5kLFxuICAgICAgICAgICAgYXJncyxcbiAgICAgICAgfSxcbiAgICB9O1xuXG4gICAgLy8gRGVsZWdhdGUgZnVydGhlciBwYXJzaW5nIHRvIHNoZWxsIG9yIG5vbi1zaGVsbFxuICAgIHJldHVybiBvcHRpb25zLnNoZWxsID8gcGFyc2VkIDogcGFyc2VOb25TaGVsbChwYXJzZWQpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCBpc1dpbiA9IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMic7XG5cbmZ1bmN0aW9uIG5vdEZvdW5kRXJyb3Iob3JpZ2luYWwsIHN5c2NhbGwpIHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihuZXcgRXJyb3IoYCR7c3lzY2FsbH0gJHtvcmlnaW5hbC5jb21tYW5kfSBFTk9FTlRgKSwge1xuICAgICAgICBjb2RlOiAnRU5PRU5UJyxcbiAgICAgICAgZXJybm86ICdFTk9FTlQnLFxuICAgICAgICBzeXNjYWxsOiBgJHtzeXNjYWxsfSAke29yaWdpbmFsLmNvbW1hbmR9YCxcbiAgICAgICAgcGF0aDogb3JpZ2luYWwuY29tbWFuZCxcbiAgICAgICAgc3Bhd25hcmdzOiBvcmlnaW5hbC5hcmdzLFxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBob29rQ2hpbGRQcm9jZXNzKGNwLCBwYXJzZWQpIHtcbiAgICBpZiAoIWlzV2luKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBvcmlnaW5hbEVtaXQgPSBjcC5lbWl0O1xuXG4gICAgY3AuZW1pdCA9IGZ1bmN0aW9uIChuYW1lLCBhcmcxKSB7XG4gICAgICAgIC8vIElmIGVtaXR0aW5nIFwiZXhpdFwiIGV2ZW50IGFuZCBleGl0IGNvZGUgaXMgMSwgd2UgbmVlZCB0byBjaGVjayBpZlxuICAgICAgICAvLyB0aGUgY29tbWFuZCBleGlzdHMgYW5kIGVtaXQgYW4gXCJlcnJvclwiIGluc3RlYWRcbiAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9JbmRpZ29Vbml0ZWQvbm9kZS1jcm9zcy1zcGF3bi9pc3N1ZXMvMTZcbiAgICAgICAgaWYgKG5hbWUgPT09ICdleGl0Jykge1xuICAgICAgICAgICAgY29uc3QgZXJyID0gdmVyaWZ5RU5PRU5UKGFyZzEsIHBhcnNlZCwgJ3NwYXduJyk7XG5cbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb3JpZ2luYWxFbWl0LmNhbGwoY3AsICdlcnJvcicsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3JpZ2luYWxFbWl0LmFwcGx5KGNwLCBhcmd1bWVudHMpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIHByZWZlci1yZXN0LXBhcmFtc1xuICAgIH07XG59XG5cbmZ1bmN0aW9uIHZlcmlmeUVOT0VOVChzdGF0dXMsIHBhcnNlZCkge1xuICAgIGlmIChpc1dpbiAmJiBzdGF0dXMgPT09IDEgJiYgIXBhcnNlZC5maWxlKSB7XG4gICAgICAgIHJldHVybiBub3RGb3VuZEVycm9yKHBhcnNlZC5vcmlnaW5hbCwgJ3NwYXduJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIHZlcmlmeUVOT0VOVFN5bmMoc3RhdHVzLCBwYXJzZWQpIHtcbiAgICBpZiAoaXNXaW4gJiYgc3RhdHVzID09PSAxICYmICFwYXJzZWQuZmlsZSkge1xuICAgICAgICByZXR1cm4gbm90Rm91bmRFcnJvcihwYXJzZWQub3JpZ2luYWwsICdzcGF3blN5bmMnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgaG9va0NoaWxkUHJvY2VzcyxcbiAgICB2ZXJpZnlFTk9FTlQsXG4gICAgdmVyaWZ5RU5PRU5UU3luYyxcbiAgICBub3RGb3VuZEVycm9yLFxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgY3AgPSByZXF1aXJlKCdjaGlsZF9wcm9jZXNzJyk7XG5jb25zdCBwYXJzZSA9IHJlcXVpcmUoJy4vbGliL3BhcnNlJyk7XG5jb25zdCBlbm9lbnQgPSByZXF1aXJlKCcuL2xpYi9lbm9lbnQnKTtcblxuZnVuY3Rpb24gc3Bhd24oY29tbWFuZCwgYXJncywgb3B0aW9ucykge1xuICAgIC8vIFBhcnNlIHRoZSBhcmd1bWVudHNcbiAgICBjb25zdCBwYXJzZWQgPSBwYXJzZShjb21tYW5kLCBhcmdzLCBvcHRpb25zKTtcblxuICAgIC8vIFNwYXduIHRoZSBjaGlsZCBwcm9jZXNzXG4gICAgY29uc3Qgc3Bhd25lZCA9IGNwLnNwYXduKHBhcnNlZC5jb21tYW5kLCBwYXJzZWQuYXJncywgcGFyc2VkLm9wdGlvbnMpO1xuXG4gICAgLy8gSG9vayBpbnRvIGNoaWxkIHByb2Nlc3MgXCJleGl0XCIgZXZlbnQgdG8gZW1pdCBhbiBlcnJvciBpZiB0aGUgY29tbWFuZFxuICAgIC8vIGRvZXMgbm90IGV4aXN0cywgc2VlOiBodHRwczovL2dpdGh1Yi5jb20vSW5kaWdvVW5pdGVkL25vZGUtY3Jvc3Mtc3Bhd24vaXNzdWVzLzE2XG4gICAgZW5vZW50Lmhvb2tDaGlsZFByb2Nlc3Moc3Bhd25lZCwgcGFyc2VkKTtcblxuICAgIHJldHVybiBzcGF3bmVkO1xufVxuXG5mdW5jdGlvbiBzcGF3blN5bmMoY29tbWFuZCwgYXJncywgb3B0aW9ucykge1xuICAgIC8vIFBhcnNlIHRoZSBhcmd1bWVudHNcbiAgICBjb25zdCBwYXJzZWQgPSBwYXJzZShjb21tYW5kLCBhcmdzLCBvcHRpb25zKTtcblxuICAgIC8vIFNwYXduIHRoZSBjaGlsZCBwcm9jZXNzXG4gICAgY29uc3QgcmVzdWx0ID0gY3Auc3Bhd25TeW5jKHBhcnNlZC5jb21tYW5kLCBwYXJzZWQuYXJncywgcGFyc2VkLm9wdGlvbnMpO1xuXG4gICAgLy8gQW5hbHl6ZSBpZiB0aGUgY29tbWFuZCBkb2VzIG5vdCBleGlzdCwgc2VlOiBodHRwczovL2dpdGh1Yi5jb20vSW5kaWdvVW5pdGVkL25vZGUtY3Jvc3Mtc3Bhd24vaXNzdWVzLzE2XG4gICAgcmVzdWx0LmVycm9yID0gcmVzdWx0LmVycm9yIHx8IGVub2VudC52ZXJpZnlFTk9FTlRTeW5jKHJlc3VsdC5zdGF0dXMsIHBhcnNlZCk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNwYXduO1xubW9kdWxlLmV4cG9ydHMuc3Bhd24gPSBzcGF3bjtcbm1vZHVsZS5leHBvcnRzLnN5bmMgPSBzcGF3blN5bmM7XG5cbm1vZHVsZS5leHBvcnRzLl9wYXJzZSA9IHBhcnNlO1xubW9kdWxlLmV4cG9ydHMuX2Vub2VudCA9IGVub2VudDtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBpbnB1dCA9PiB7XG5cdGNvbnN0IExGID0gdHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJyA/ICdcXG4nIDogJ1xcbicuY2hhckNvZGVBdCgpO1xuXHRjb25zdCBDUiA9IHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycgPyAnXFxyJyA6ICdcXHInLmNoYXJDb2RlQXQoKTtcblxuXHRpZiAoaW5wdXRbaW5wdXQubGVuZ3RoIC0gMV0gPT09IExGKSB7XG5cdFx0aW5wdXQgPSBpbnB1dC5zbGljZSgwLCBpbnB1dC5sZW5ndGggLSAxKTtcblx0fVxuXG5cdGlmIChpbnB1dFtpbnB1dC5sZW5ndGggLSAxXSA9PT0gQ1IpIHtcblx0XHRpbnB1dCA9IGlucHV0LnNsaWNlKDAsIGlucHV0Lmxlbmd0aCAtIDEpO1xuXHR9XG5cblx0cmV0dXJuIGlucHV0O1xufTtcbiIsIid1c2Ugc3RyaWN0JztcbmNvbnN0IHBhdGggPSByZXF1aXJlKCdwYXRoJyk7XG5jb25zdCBwYXRoS2V5ID0gcmVxdWlyZSgncGF0aC1rZXknKTtcblxuY29uc3QgbnBtUnVuUGF0aCA9IG9wdGlvbnMgPT4ge1xuXHRvcHRpb25zID0ge1xuXHRcdGN3ZDogcHJvY2Vzcy5jd2QoKSxcblx0XHRwYXRoOiBwcm9jZXNzLmVudltwYXRoS2V5KCldLFxuXHRcdGV4ZWNQYXRoOiBwcm9jZXNzLmV4ZWNQYXRoLFxuXHRcdC4uLm9wdGlvbnNcblx0fTtcblxuXHRsZXQgcHJldmlvdXM7XG5cdGxldCBjd2RQYXRoID0gcGF0aC5yZXNvbHZlKG9wdGlvbnMuY3dkKTtcblx0Y29uc3QgcmVzdWx0ID0gW107XG5cblx0d2hpbGUgKHByZXZpb3VzICE9PSBjd2RQYXRoKSB7XG5cdFx0cmVzdWx0LnB1c2gocGF0aC5qb2luKGN3ZFBhdGgsICdub2RlX21vZHVsZXMvLmJpbicpKTtcblx0XHRwcmV2aW91cyA9IGN3ZFBhdGg7XG5cdFx0Y3dkUGF0aCA9IHBhdGgucmVzb2x2ZShjd2RQYXRoLCAnLi4nKTtcblx0fVxuXG5cdC8vIEVuc3VyZSB0aGUgcnVubmluZyBgbm9kZWAgYmluYXJ5IGlzIHVzZWRcblx0Y29uc3QgZXhlY1BhdGhEaXIgPSBwYXRoLnJlc29sdmUob3B0aW9ucy5jd2QsIG9wdGlvbnMuZXhlY1BhdGgsICcuLicpO1xuXHRyZXN1bHQucHVzaChleGVjUGF0aERpcik7XG5cblx0cmV0dXJuIHJlc3VsdC5jb25jYXQob3B0aW9ucy5wYXRoKS5qb2luKHBhdGguZGVsaW1pdGVyKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbnBtUnVuUGF0aDtcbi8vIFRPRE86IFJlbW92ZSB0aGlzIGZvciB0aGUgbmV4dCBtYWpvciByZWxlYXNlXG5tb2R1bGUuZXhwb3J0cy5kZWZhdWx0ID0gbnBtUnVuUGF0aDtcblxubW9kdWxlLmV4cG9ydHMuZW52ID0gb3B0aW9ucyA9PiB7XG5cdG9wdGlvbnMgPSB7XG5cdFx0ZW52OiBwcm9jZXNzLmVudixcblx0XHQuLi5vcHRpb25zXG5cdH07XG5cblx0Y29uc3QgZW52ID0gey4uLm9wdGlvbnMuZW52fTtcblx0Y29uc3QgcGF0aCA9IHBhdGhLZXkoe2Vudn0pO1xuXG5cdG9wdGlvbnMucGF0aCA9IGVudltwYXRoXTtcblx0ZW52W3BhdGhdID0gbW9kdWxlLmV4cG9ydHMob3B0aW9ucyk7XG5cblx0cmV0dXJuIGVudjtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IG1pbWljRm4gPSAodG8sIGZyb20pID0+IHtcblx0Zm9yIChjb25zdCBwcm9wIG9mIFJlZmxlY3Qub3duS2V5cyhmcm9tKSkge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0bywgcHJvcCwgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihmcm9tLCBwcm9wKSk7XG5cdH1cblxuXHRyZXR1cm4gdG87XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG1pbWljRm47XG4vLyBUT0RPOiBSZW1vdmUgdGhpcyBmb3IgdGhlIG5leHQgbWFqb3IgcmVsZWFzZVxubW9kdWxlLmV4cG9ydHMuZGVmYXVsdCA9IG1pbWljRm47XG4iLCIndXNlIHN0cmljdCc7XG5jb25zdCBtaW1pY0ZuID0gcmVxdWlyZSgnbWltaWMtZm4nKTtcblxuY29uc3QgY2FsbGVkRnVuY3Rpb25zID0gbmV3IFdlYWtNYXAoKTtcblxuY29uc3Qgb25ldGltZSA9IChmdW5jdGlvbl8sIG9wdGlvbnMgPSB7fSkgPT4ge1xuXHRpZiAodHlwZW9mIGZ1bmN0aW9uXyAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIGEgZnVuY3Rpb24nKTtcblx0fVxuXG5cdGxldCByZXR1cm5WYWx1ZTtcblx0bGV0IGNhbGxDb3VudCA9IDA7XG5cdGNvbnN0IGZ1bmN0aW9uTmFtZSA9IGZ1bmN0aW9uXy5kaXNwbGF5TmFtZSB8fCBmdW5jdGlvbl8ubmFtZSB8fCAnPGFub255bW91cz4nO1xuXG5cdGNvbnN0IG9uZXRpbWUgPSBmdW5jdGlvbiAoLi4uYXJndW1lbnRzXykge1xuXHRcdGNhbGxlZEZ1bmN0aW9ucy5zZXQob25ldGltZSwgKytjYWxsQ291bnQpO1xuXG5cdFx0aWYgKGNhbGxDb3VudCA9PT0gMSkge1xuXHRcdFx0cmV0dXJuVmFsdWUgPSBmdW5jdGlvbl8uYXBwbHkodGhpcywgYXJndW1lbnRzXyk7XG5cdFx0XHRmdW5jdGlvbl8gPSBudWxsO1xuXHRcdH0gZWxzZSBpZiAob3B0aW9ucy50aHJvdyA9PT0gdHJ1ZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBGdW5jdGlvbiBcXGAke2Z1bmN0aW9uTmFtZX1cXGAgY2FuIG9ubHkgYmUgY2FsbGVkIG9uY2VgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmV0dXJuVmFsdWU7XG5cdH07XG5cblx0bWltaWNGbihvbmV0aW1lLCBmdW5jdGlvbl8pO1xuXHRjYWxsZWRGdW5jdGlvbnMuc2V0KG9uZXRpbWUsIGNhbGxDb3VudCk7XG5cblx0cmV0dXJuIG9uZXRpbWU7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG9uZXRpbWU7XG4vLyBUT0RPOiBSZW1vdmUgdGhpcyBmb3IgdGhlIG5leHQgbWFqb3IgcmVsZWFzZVxubW9kdWxlLmV4cG9ydHMuZGVmYXVsdCA9IG9uZXRpbWU7XG5cbm1vZHVsZS5leHBvcnRzLmNhbGxDb3VudCA9IGZ1bmN0aW9uXyA9PiB7XG5cdGlmICghY2FsbGVkRnVuY3Rpb25zLmhhcyhmdW5jdGlvbl8pKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBUaGUgZ2l2ZW4gZnVuY3Rpb24gXFxgJHtmdW5jdGlvbl8ubmFtZX1cXGAgaXMgbm90IHdyYXBwZWQgYnkgdGhlIFxcYG9uZXRpbWVcXGAgcGFja2FnZWApO1xuXHR9XG5cblx0cmV0dXJuIGNhbGxlZEZ1bmN0aW9ucy5nZXQoZnVuY3Rpb25fKTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cyxcIl9fZXNNb2R1bGVcIix7dmFsdWU6dHJ1ZX0pO2V4cG9ydHMuU0lHTkFMUz12b2lkIDA7XG5cbmNvbnN0IFNJR05BTFM9W1xue1xubmFtZTpcIlNJR0hVUFwiLFxubnVtYmVyOjEsXG5hY3Rpb246XCJ0ZXJtaW5hdGVcIixcbmRlc2NyaXB0aW9uOlwiVGVybWluYWwgY2xvc2VkXCIsXG5zdGFuZGFyZDpcInBvc2l4XCJ9LFxuXG57XG5uYW1lOlwiU0lHSU5UXCIsXG5udW1iZXI6MixcbmFjdGlvbjpcInRlcm1pbmF0ZVwiLFxuZGVzY3JpcHRpb246XCJVc2VyIGludGVycnVwdGlvbiB3aXRoIENUUkwtQ1wiLFxuc3RhbmRhcmQ6XCJhbnNpXCJ9LFxuXG57XG5uYW1lOlwiU0lHUVVJVFwiLFxubnVtYmVyOjMsXG5hY3Rpb246XCJjb3JlXCIsXG5kZXNjcmlwdGlvbjpcIlVzZXIgaW50ZXJydXB0aW9uIHdpdGggQ1RSTC1cXFxcXCIsXG5zdGFuZGFyZDpcInBvc2l4XCJ9LFxuXG57XG5uYW1lOlwiU0lHSUxMXCIsXG5udW1iZXI6NCxcbmFjdGlvbjpcImNvcmVcIixcbmRlc2NyaXB0aW9uOlwiSW52YWxpZCBtYWNoaW5lIGluc3RydWN0aW9uXCIsXG5zdGFuZGFyZDpcImFuc2lcIn0sXG5cbntcbm5hbWU6XCJTSUdUUkFQXCIsXG5udW1iZXI6NSxcbmFjdGlvbjpcImNvcmVcIixcbmRlc2NyaXB0aW9uOlwiRGVidWdnZXIgYnJlYWtwb2ludFwiLFxuc3RhbmRhcmQ6XCJwb3NpeFwifSxcblxue1xubmFtZTpcIlNJR0FCUlRcIixcbm51bWJlcjo2LFxuYWN0aW9uOlwiY29yZVwiLFxuZGVzY3JpcHRpb246XCJBYm9ydGVkXCIsXG5zdGFuZGFyZDpcImFuc2lcIn0sXG5cbntcbm5hbWU6XCJTSUdJT1RcIixcbm51bWJlcjo2LFxuYWN0aW9uOlwiY29yZVwiLFxuZGVzY3JpcHRpb246XCJBYm9ydGVkXCIsXG5zdGFuZGFyZDpcImJzZFwifSxcblxue1xubmFtZTpcIlNJR0JVU1wiLFxubnVtYmVyOjcsXG5hY3Rpb246XCJjb3JlXCIsXG5kZXNjcmlwdGlvbjpcblwiQnVzIGVycm9yIGR1ZSB0byBtaXNhbGlnbmVkLCBub24tZXhpc3RpbmcgYWRkcmVzcyBvciBwYWdpbmcgZXJyb3JcIixcbnN0YW5kYXJkOlwiYnNkXCJ9LFxuXG57XG5uYW1lOlwiU0lHRU1UXCIsXG5udW1iZXI6NyxcbmFjdGlvbjpcInRlcm1pbmF0ZVwiLFxuZGVzY3JpcHRpb246XCJDb21tYW5kIHNob3VsZCBiZSBlbXVsYXRlZCBidXQgaXMgbm90IGltcGxlbWVudGVkXCIsXG5zdGFuZGFyZDpcIm90aGVyXCJ9LFxuXG57XG5uYW1lOlwiU0lHRlBFXCIsXG5udW1iZXI6OCxcbmFjdGlvbjpcImNvcmVcIixcbmRlc2NyaXB0aW9uOlwiRmxvYXRpbmcgcG9pbnQgYXJpdGhtZXRpYyBlcnJvclwiLFxuc3RhbmRhcmQ6XCJhbnNpXCJ9LFxuXG57XG5uYW1lOlwiU0lHS0lMTFwiLFxubnVtYmVyOjksXG5hY3Rpb246XCJ0ZXJtaW5hdGVcIixcbmRlc2NyaXB0aW9uOlwiRm9yY2VkIHRlcm1pbmF0aW9uXCIsXG5zdGFuZGFyZDpcInBvc2l4XCIsXG5mb3JjZWQ6dHJ1ZX0sXG5cbntcbm5hbWU6XCJTSUdVU1IxXCIsXG5udW1iZXI6MTAsXG5hY3Rpb246XCJ0ZXJtaW5hdGVcIixcbmRlc2NyaXB0aW9uOlwiQXBwbGljYXRpb24tc3BlY2lmaWMgc2lnbmFsXCIsXG5zdGFuZGFyZDpcInBvc2l4XCJ9LFxuXG57XG5uYW1lOlwiU0lHU0VHVlwiLFxubnVtYmVyOjExLFxuYWN0aW9uOlwiY29yZVwiLFxuZGVzY3JpcHRpb246XCJTZWdtZW50YXRpb24gZmF1bHRcIixcbnN0YW5kYXJkOlwiYW5zaVwifSxcblxue1xubmFtZTpcIlNJR1VTUjJcIixcbm51bWJlcjoxMixcbmFjdGlvbjpcInRlcm1pbmF0ZVwiLFxuZGVzY3JpcHRpb246XCJBcHBsaWNhdGlvbi1zcGVjaWZpYyBzaWduYWxcIixcbnN0YW5kYXJkOlwicG9zaXhcIn0sXG5cbntcbm5hbWU6XCJTSUdQSVBFXCIsXG5udW1iZXI6MTMsXG5hY3Rpb246XCJ0ZXJtaW5hdGVcIixcbmRlc2NyaXB0aW9uOlwiQnJva2VuIHBpcGUgb3Igc29ja2V0XCIsXG5zdGFuZGFyZDpcInBvc2l4XCJ9LFxuXG57XG5uYW1lOlwiU0lHQUxSTVwiLFxubnVtYmVyOjE0LFxuYWN0aW9uOlwidGVybWluYXRlXCIsXG5kZXNjcmlwdGlvbjpcIlRpbWVvdXQgb3IgdGltZXJcIixcbnN0YW5kYXJkOlwicG9zaXhcIn0sXG5cbntcbm5hbWU6XCJTSUdURVJNXCIsXG5udW1iZXI6MTUsXG5hY3Rpb246XCJ0ZXJtaW5hdGVcIixcbmRlc2NyaXB0aW9uOlwiVGVybWluYXRpb25cIixcbnN0YW5kYXJkOlwiYW5zaVwifSxcblxue1xubmFtZTpcIlNJR1NUS0ZMVFwiLFxubnVtYmVyOjE2LFxuYWN0aW9uOlwidGVybWluYXRlXCIsXG5kZXNjcmlwdGlvbjpcIlN0YWNrIGlzIGVtcHR5IG9yIG92ZXJmbG93ZWRcIixcbnN0YW5kYXJkOlwib3RoZXJcIn0sXG5cbntcbm5hbWU6XCJTSUdDSExEXCIsXG5udW1iZXI6MTcsXG5hY3Rpb246XCJpZ25vcmVcIixcbmRlc2NyaXB0aW9uOlwiQ2hpbGQgcHJvY2VzcyB0ZXJtaW5hdGVkLCBwYXVzZWQgb3IgdW5wYXVzZWRcIixcbnN0YW5kYXJkOlwicG9zaXhcIn0sXG5cbntcbm5hbWU6XCJTSUdDTERcIixcbm51bWJlcjoxNyxcbmFjdGlvbjpcImlnbm9yZVwiLFxuZGVzY3JpcHRpb246XCJDaGlsZCBwcm9jZXNzIHRlcm1pbmF0ZWQsIHBhdXNlZCBvciB1bnBhdXNlZFwiLFxuc3RhbmRhcmQ6XCJvdGhlclwifSxcblxue1xubmFtZTpcIlNJR0NPTlRcIixcbm51bWJlcjoxOCxcbmFjdGlvbjpcInVucGF1c2VcIixcbmRlc2NyaXB0aW9uOlwiVW5wYXVzZWRcIixcbnN0YW5kYXJkOlwicG9zaXhcIixcbmZvcmNlZDp0cnVlfSxcblxue1xubmFtZTpcIlNJR1NUT1BcIixcbm51bWJlcjoxOSxcbmFjdGlvbjpcInBhdXNlXCIsXG5kZXNjcmlwdGlvbjpcIlBhdXNlZFwiLFxuc3RhbmRhcmQ6XCJwb3NpeFwiLFxuZm9yY2VkOnRydWV9LFxuXG57XG5uYW1lOlwiU0lHVFNUUFwiLFxubnVtYmVyOjIwLFxuYWN0aW9uOlwicGF1c2VcIixcbmRlc2NyaXB0aW9uOlwiUGF1c2VkIHVzaW5nIENUUkwtWiBvciBcXFwic3VzcGVuZFxcXCJcIixcbnN0YW5kYXJkOlwicG9zaXhcIn0sXG5cbntcbm5hbWU6XCJTSUdUVElOXCIsXG5udW1iZXI6MjEsXG5hY3Rpb246XCJwYXVzZVwiLFxuZGVzY3JpcHRpb246XCJCYWNrZ3JvdW5kIHByb2Nlc3MgY2Fubm90IHJlYWQgdGVybWluYWwgaW5wdXRcIixcbnN0YW5kYXJkOlwicG9zaXhcIn0sXG5cbntcbm5hbWU6XCJTSUdCUkVBS1wiLFxubnVtYmVyOjIxLFxuYWN0aW9uOlwidGVybWluYXRlXCIsXG5kZXNjcmlwdGlvbjpcIlVzZXIgaW50ZXJydXB0aW9uIHdpdGggQ1RSTC1CUkVBS1wiLFxuc3RhbmRhcmQ6XCJvdGhlclwifSxcblxue1xubmFtZTpcIlNJR1RUT1VcIixcbm51bWJlcjoyMixcbmFjdGlvbjpcInBhdXNlXCIsXG5kZXNjcmlwdGlvbjpcIkJhY2tncm91bmQgcHJvY2VzcyBjYW5ub3Qgd3JpdGUgdG8gdGVybWluYWwgb3V0cHV0XCIsXG5zdGFuZGFyZDpcInBvc2l4XCJ9LFxuXG57XG5uYW1lOlwiU0lHVVJHXCIsXG5udW1iZXI6MjMsXG5hY3Rpb246XCJpZ25vcmVcIixcbmRlc2NyaXB0aW9uOlwiU29ja2V0IHJlY2VpdmVkIG91dC1vZi1iYW5kIGRhdGFcIixcbnN0YW5kYXJkOlwiYnNkXCJ9LFxuXG57XG5uYW1lOlwiU0lHWENQVVwiLFxubnVtYmVyOjI0LFxuYWN0aW9uOlwiY29yZVwiLFxuZGVzY3JpcHRpb246XCJQcm9jZXNzIHRpbWVkIG91dFwiLFxuc3RhbmRhcmQ6XCJic2RcIn0sXG5cbntcbm5hbWU6XCJTSUdYRlNaXCIsXG5udW1iZXI6MjUsXG5hY3Rpb246XCJjb3JlXCIsXG5kZXNjcmlwdGlvbjpcIkZpbGUgdG9vIGJpZ1wiLFxuc3RhbmRhcmQ6XCJic2RcIn0sXG5cbntcbm5hbWU6XCJTSUdWVEFMUk1cIixcbm51bWJlcjoyNixcbmFjdGlvbjpcInRlcm1pbmF0ZVwiLFxuZGVzY3JpcHRpb246XCJUaW1lb3V0IG9yIHRpbWVyXCIsXG5zdGFuZGFyZDpcImJzZFwifSxcblxue1xubmFtZTpcIlNJR1BST0ZcIixcbm51bWJlcjoyNyxcbmFjdGlvbjpcInRlcm1pbmF0ZVwiLFxuZGVzY3JpcHRpb246XCJUaW1lb3V0IG9yIHRpbWVyXCIsXG5zdGFuZGFyZDpcImJzZFwifSxcblxue1xubmFtZTpcIlNJR1dJTkNIXCIsXG5udW1iZXI6MjgsXG5hY3Rpb246XCJpZ25vcmVcIixcbmRlc2NyaXB0aW9uOlwiVGVybWluYWwgd2luZG93IHNpemUgY2hhbmdlZFwiLFxuc3RhbmRhcmQ6XCJic2RcIn0sXG5cbntcbm5hbWU6XCJTSUdJT1wiLFxubnVtYmVyOjI5LFxuYWN0aW9uOlwidGVybWluYXRlXCIsXG5kZXNjcmlwdGlvbjpcIkkvTyBpcyBhdmFpbGFibGVcIixcbnN0YW5kYXJkOlwib3RoZXJcIn0sXG5cbntcbm5hbWU6XCJTSUdQT0xMXCIsXG5udW1iZXI6MjksXG5hY3Rpb246XCJ0ZXJtaW5hdGVcIixcbmRlc2NyaXB0aW9uOlwiV2F0Y2hlZCBldmVudFwiLFxuc3RhbmRhcmQ6XCJvdGhlclwifSxcblxue1xubmFtZTpcIlNJR0lORk9cIixcbm51bWJlcjoyOSxcbmFjdGlvbjpcImlnbm9yZVwiLFxuZGVzY3JpcHRpb246XCJSZXF1ZXN0IGZvciBwcm9jZXNzIGluZm9ybWF0aW9uXCIsXG5zdGFuZGFyZDpcIm90aGVyXCJ9LFxuXG57XG5uYW1lOlwiU0lHUFdSXCIsXG5udW1iZXI6MzAsXG5hY3Rpb246XCJ0ZXJtaW5hdGVcIixcbmRlc2NyaXB0aW9uOlwiRGV2aWNlIHJ1bm5pbmcgb3V0IG9mIHBvd2VyXCIsXG5zdGFuZGFyZDpcInN5c3RlbXZcIn0sXG5cbntcbm5hbWU6XCJTSUdTWVNcIixcbm51bWJlcjozMSxcbmFjdGlvbjpcImNvcmVcIixcbmRlc2NyaXB0aW9uOlwiSW52YWxpZCBzeXN0ZW0gY2FsbFwiLFxuc3RhbmRhcmQ6XCJvdGhlclwifSxcblxue1xubmFtZTpcIlNJR1VOVVNFRFwiLFxubnVtYmVyOjMxLFxuYWN0aW9uOlwidGVybWluYXRlXCIsXG5kZXNjcmlwdGlvbjpcIkludmFsaWQgc3lzdGVtIGNhbGxcIixcbnN0YW5kYXJkOlwib3RoZXJcIn1dO2V4cG9ydHMuU0lHTkFMUz1TSUdOQUxTO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y29yZS5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cyxcIl9fZXNNb2R1bGVcIix7dmFsdWU6dHJ1ZX0pO2V4cG9ydHMuU0lHUlRNQVg9ZXhwb3J0cy5nZXRSZWFsdGltZVNpZ25hbHM9dm9pZCAwO1xuY29uc3QgZ2V0UmVhbHRpbWVTaWduYWxzPWZ1bmN0aW9uKCl7XG5jb25zdCBsZW5ndGg9U0lHUlRNQVgtU0lHUlRNSU4rMTtcbnJldHVybiBBcnJheS5mcm9tKHtsZW5ndGh9LGdldFJlYWx0aW1lU2lnbmFsKTtcbn07ZXhwb3J0cy5nZXRSZWFsdGltZVNpZ25hbHM9Z2V0UmVhbHRpbWVTaWduYWxzO1xuXG5jb25zdCBnZXRSZWFsdGltZVNpZ25hbD1mdW5jdGlvbih2YWx1ZSxpbmRleCl7XG5yZXR1cm57XG5uYW1lOmBTSUdSVCR7aW5kZXgrMX1gLFxubnVtYmVyOlNJR1JUTUlOK2luZGV4LFxuYWN0aW9uOlwidGVybWluYXRlXCIsXG5kZXNjcmlwdGlvbjpcIkFwcGxpY2F0aW9uLXNwZWNpZmljIHNpZ25hbCAocmVhbHRpbWUpXCIsXG5zdGFuZGFyZDpcInBvc2l4XCJ9O1xuXG59O1xuXG5jb25zdCBTSUdSVE1JTj0zNDtcbmNvbnN0IFNJR1JUTUFYPTY0O2V4cG9ydHMuU0lHUlRNQVg9U0lHUlRNQVg7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1yZWFsdGltZS5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cyxcIl9fZXNNb2R1bGVcIix7dmFsdWU6dHJ1ZX0pO2V4cG9ydHMuZ2V0U2lnbmFscz12b2lkIDA7dmFyIF9vcz1yZXF1aXJlKFwib3NcIik7XG5cbnZhciBfY29yZT1yZXF1aXJlKFwiLi9jb3JlLmpzXCIpO1xudmFyIF9yZWFsdGltZT1yZXF1aXJlKFwiLi9yZWFsdGltZS5qc1wiKTtcblxuXG5cbmNvbnN0IGdldFNpZ25hbHM9ZnVuY3Rpb24oKXtcbmNvbnN0IHJlYWx0aW1lU2lnbmFscz0oMCxfcmVhbHRpbWUuZ2V0UmVhbHRpbWVTaWduYWxzKSgpO1xuY29uc3Qgc2lnbmFscz1bLi4uX2NvcmUuU0lHTkFMUywuLi5yZWFsdGltZVNpZ25hbHNdLm1hcChub3JtYWxpemVTaWduYWwpO1xucmV0dXJuIHNpZ25hbHM7XG59O2V4cG9ydHMuZ2V0U2lnbmFscz1nZXRTaWduYWxzO1xuXG5cblxuXG5cblxuXG5jb25zdCBub3JtYWxpemVTaWduYWw9ZnVuY3Rpb24oe1xubmFtZSxcbm51bWJlcjpkZWZhdWx0TnVtYmVyLFxuZGVzY3JpcHRpb24sXG5hY3Rpb24sXG5mb3JjZWQ9ZmFsc2UsXG5zdGFuZGFyZH0pXG57XG5jb25zdHtcbnNpZ25hbHM6e1tuYW1lXTpjb25zdGFudFNpZ25hbH19PVxuX29zLmNvbnN0YW50cztcbmNvbnN0IHN1cHBvcnRlZD1jb25zdGFudFNpZ25hbCE9PXVuZGVmaW5lZDtcbmNvbnN0IG51bWJlcj1zdXBwb3J0ZWQ/Y29uc3RhbnRTaWduYWw6ZGVmYXVsdE51bWJlcjtcbnJldHVybntuYW1lLG51bWJlcixkZXNjcmlwdGlvbixzdXBwb3J0ZWQsYWN0aW9uLGZvcmNlZCxzdGFuZGFyZH07XG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9c2lnbmFscy5qcy5tYXAiLCJcInVzZSBzdHJpY3RcIjtPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cyxcIl9fZXNNb2R1bGVcIix7dmFsdWU6dHJ1ZX0pO2V4cG9ydHMuc2lnbmFsc0J5TnVtYmVyPWV4cG9ydHMuc2lnbmFsc0J5TmFtZT12b2lkIDA7dmFyIF9vcz1yZXF1aXJlKFwib3NcIik7XG5cbnZhciBfc2lnbmFscz1yZXF1aXJlKFwiLi9zaWduYWxzLmpzXCIpO1xudmFyIF9yZWFsdGltZT1yZXF1aXJlKFwiLi9yZWFsdGltZS5qc1wiKTtcblxuXG5cbmNvbnN0IGdldFNpZ25hbHNCeU5hbWU9ZnVuY3Rpb24oKXtcbmNvbnN0IHNpZ25hbHM9KDAsX3NpZ25hbHMuZ2V0U2lnbmFscykoKTtcbnJldHVybiBzaWduYWxzLnJlZHVjZShnZXRTaWduYWxCeU5hbWUse30pO1xufTtcblxuY29uc3QgZ2V0U2lnbmFsQnlOYW1lPWZ1bmN0aW9uKFxuc2lnbmFsQnlOYW1lTWVtbyxcbntuYW1lLG51bWJlcixkZXNjcmlwdGlvbixzdXBwb3J0ZWQsYWN0aW9uLGZvcmNlZCxzdGFuZGFyZH0pXG57XG5yZXR1cm57XG4uLi5zaWduYWxCeU5hbWVNZW1vLFxuW25hbWVdOntuYW1lLG51bWJlcixkZXNjcmlwdGlvbixzdXBwb3J0ZWQsYWN0aW9uLGZvcmNlZCxzdGFuZGFyZH19O1xuXG59O1xuXG5jb25zdCBzaWduYWxzQnlOYW1lPWdldFNpZ25hbHNCeU5hbWUoKTtleHBvcnRzLnNpZ25hbHNCeU5hbWU9c2lnbmFsc0J5TmFtZTtcblxuXG5cblxuY29uc3QgZ2V0U2lnbmFsc0J5TnVtYmVyPWZ1bmN0aW9uKCl7XG5jb25zdCBzaWduYWxzPSgwLF9zaWduYWxzLmdldFNpZ25hbHMpKCk7XG5jb25zdCBsZW5ndGg9X3JlYWx0aW1lLlNJR1JUTUFYKzE7XG5jb25zdCBzaWduYWxzQT1BcnJheS5mcm9tKHtsZW5ndGh9LCh2YWx1ZSxudW1iZXIpPT5cbmdldFNpZ25hbEJ5TnVtYmVyKG51bWJlcixzaWduYWxzKSk7XG5cbnJldHVybiBPYmplY3QuYXNzaWduKHt9LC4uLnNpZ25hbHNBKTtcbn07XG5cbmNvbnN0IGdldFNpZ25hbEJ5TnVtYmVyPWZ1bmN0aW9uKG51bWJlcixzaWduYWxzKXtcbmNvbnN0IHNpZ25hbD1maW5kU2lnbmFsQnlOdW1iZXIobnVtYmVyLHNpZ25hbHMpO1xuXG5pZihzaWduYWw9PT11bmRlZmluZWQpe1xucmV0dXJue307XG59XG5cbmNvbnN0e25hbWUsZGVzY3JpcHRpb24sc3VwcG9ydGVkLGFjdGlvbixmb3JjZWQsc3RhbmRhcmR9PXNpZ25hbDtcbnJldHVybntcbltudW1iZXJdOntcbm5hbWUsXG5udW1iZXIsXG5kZXNjcmlwdGlvbixcbnN1cHBvcnRlZCxcbmFjdGlvbixcbmZvcmNlZCxcbnN0YW5kYXJkfX07XG5cblxufTtcblxuXG5cbmNvbnN0IGZpbmRTaWduYWxCeU51bWJlcj1mdW5jdGlvbihudW1iZXIsc2lnbmFscyl7XG5jb25zdCBzaWduYWw9c2lnbmFscy5maW5kKCh7bmFtZX0pPT5fb3MuY29uc3RhbnRzLnNpZ25hbHNbbmFtZV09PT1udW1iZXIpO1xuXG5pZihzaWduYWwhPT11bmRlZmluZWQpe1xucmV0dXJuIHNpZ25hbDtcbn1cblxucmV0dXJuIHNpZ25hbHMuZmluZChzaWduYWxBPT5zaWduYWxBLm51bWJlcj09PW51bWJlcik7XG59O1xuXG5jb25zdCBzaWduYWxzQnlOdW1iZXI9Z2V0U2lnbmFsc0J5TnVtYmVyKCk7ZXhwb3J0cy5zaWduYWxzQnlOdW1iZXI9c2lnbmFsc0J5TnVtYmVyO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9bWFpbi5qcy5tYXAiLCIndXNlIHN0cmljdCc7XG5jb25zdCB7c2lnbmFsc0J5TmFtZX0gPSByZXF1aXJlKCdodW1hbi1zaWduYWxzJyk7XG5cbmNvbnN0IGdldEVycm9yUHJlZml4ID0gKHt0aW1lZE91dCwgdGltZW91dCwgZXJyb3JDb2RlLCBzaWduYWwsIHNpZ25hbERlc2NyaXB0aW9uLCBleGl0Q29kZSwgaXNDYW5jZWxlZH0pID0+IHtcblx0aWYgKHRpbWVkT3V0KSB7XG5cdFx0cmV0dXJuIGB0aW1lZCBvdXQgYWZ0ZXIgJHt0aW1lb3V0fSBtaWxsaXNlY29uZHNgO1xuXHR9XG5cblx0aWYgKGlzQ2FuY2VsZWQpIHtcblx0XHRyZXR1cm4gJ3dhcyBjYW5jZWxlZCc7XG5cdH1cblxuXHRpZiAoZXJyb3JDb2RlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gYGZhaWxlZCB3aXRoICR7ZXJyb3JDb2RlfWA7XG5cdH1cblxuXHRpZiAoc2lnbmFsICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gYHdhcyBraWxsZWQgd2l0aCAke3NpZ25hbH0gKCR7c2lnbmFsRGVzY3JpcHRpb259KWA7XG5cdH1cblxuXHRpZiAoZXhpdENvZGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBgZmFpbGVkIHdpdGggZXhpdCBjb2RlICR7ZXhpdENvZGV9YDtcblx0fVxuXG5cdHJldHVybiAnZmFpbGVkJztcbn07XG5cbmNvbnN0IG1ha2VFcnJvciA9ICh7XG5cdHN0ZG91dCxcblx0c3RkZXJyLFxuXHRhbGwsXG5cdGVycm9yLFxuXHRzaWduYWwsXG5cdGV4aXRDb2RlLFxuXHRjb21tYW5kLFxuXHRlc2NhcGVkQ29tbWFuZCxcblx0dGltZWRPdXQsXG5cdGlzQ2FuY2VsZWQsXG5cdGtpbGxlZCxcblx0cGFyc2VkOiB7b3B0aW9uczoge3RpbWVvdXR9fVxufSkgPT4ge1xuXHQvLyBgc2lnbmFsYCBhbmQgYGV4aXRDb2RlYCBlbWl0dGVkIG9uIGBzcGF3bmVkLm9uKCdleGl0JylgIGV2ZW50IGNhbiBiZSBgbnVsbGAuXG5cdC8vIFdlIG5vcm1hbGl6ZSB0aGVtIHRvIGB1bmRlZmluZWRgXG5cdGV4aXRDb2RlID0gZXhpdENvZGUgPT09IG51bGwgPyB1bmRlZmluZWQgOiBleGl0Q29kZTtcblx0c2lnbmFsID0gc2lnbmFsID09PSBudWxsID8gdW5kZWZpbmVkIDogc2lnbmFsO1xuXHRjb25zdCBzaWduYWxEZXNjcmlwdGlvbiA9IHNpZ25hbCA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogc2lnbmFsc0J5TmFtZVtzaWduYWxdLmRlc2NyaXB0aW9uO1xuXG5cdGNvbnN0IGVycm9yQ29kZSA9IGVycm9yICYmIGVycm9yLmNvZGU7XG5cblx0Y29uc3QgcHJlZml4ID0gZ2V0RXJyb3JQcmVmaXgoe3RpbWVkT3V0LCB0aW1lb3V0LCBlcnJvckNvZGUsIHNpZ25hbCwgc2lnbmFsRGVzY3JpcHRpb24sIGV4aXRDb2RlLCBpc0NhbmNlbGVkfSk7XG5cdGNvbnN0IGV4ZWNhTWVzc2FnZSA9IGBDb21tYW5kICR7cHJlZml4fTogJHtjb21tYW5kfWA7XG5cdGNvbnN0IGlzRXJyb3IgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoZXJyb3IpID09PSAnW29iamVjdCBFcnJvcl0nO1xuXHRjb25zdCBzaG9ydE1lc3NhZ2UgPSBpc0Vycm9yID8gYCR7ZXhlY2FNZXNzYWdlfVxcbiR7ZXJyb3IubWVzc2FnZX1gIDogZXhlY2FNZXNzYWdlO1xuXHRjb25zdCBtZXNzYWdlID0gW3Nob3J0TWVzc2FnZSwgc3RkZXJyLCBzdGRvdXRdLmZpbHRlcihCb29sZWFuKS5qb2luKCdcXG4nKTtcblxuXHRpZiAoaXNFcnJvcikge1xuXHRcdGVycm9yLm9yaWdpbmFsTWVzc2FnZSA9IGVycm9yLm1lc3NhZ2U7XG5cdFx0ZXJyb3IubWVzc2FnZSA9IG1lc3NhZ2U7XG5cdH0gZWxzZSB7XG5cdFx0ZXJyb3IgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG5cdH1cblxuXHRlcnJvci5zaG9ydE1lc3NhZ2UgPSBzaG9ydE1lc3NhZ2U7XG5cdGVycm9yLmNvbW1hbmQgPSBjb21tYW5kO1xuXHRlcnJvci5lc2NhcGVkQ29tbWFuZCA9IGVzY2FwZWRDb21tYW5kO1xuXHRlcnJvci5leGl0Q29kZSA9IGV4aXRDb2RlO1xuXHRlcnJvci5zaWduYWwgPSBzaWduYWw7XG5cdGVycm9yLnNpZ25hbERlc2NyaXB0aW9uID0gc2lnbmFsRGVzY3JpcHRpb247XG5cdGVycm9yLnN0ZG91dCA9IHN0ZG91dDtcblx0ZXJyb3Iuc3RkZXJyID0gc3RkZXJyO1xuXG5cdGlmIChhbGwgIT09IHVuZGVmaW5lZCkge1xuXHRcdGVycm9yLmFsbCA9IGFsbDtcblx0fVxuXG5cdGlmICgnYnVmZmVyZWREYXRhJyBpbiBlcnJvcikge1xuXHRcdGRlbGV0ZSBlcnJvci5idWZmZXJlZERhdGE7XG5cdH1cblxuXHRlcnJvci5mYWlsZWQgPSB0cnVlO1xuXHRlcnJvci50aW1lZE91dCA9IEJvb2xlYW4odGltZWRPdXQpO1xuXHRlcnJvci5pc0NhbmNlbGVkID0gaXNDYW5jZWxlZDtcblx0ZXJyb3Iua2lsbGVkID0ga2lsbGVkICYmICF0aW1lZE91dDtcblxuXHRyZXR1cm4gZXJyb3I7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG1ha2VFcnJvcjtcbiIsIid1c2Ugc3RyaWN0JztcbmNvbnN0IGFsaWFzZXMgPSBbJ3N0ZGluJywgJ3N0ZG91dCcsICdzdGRlcnInXTtcblxuY29uc3QgaGFzQWxpYXMgPSBvcHRpb25zID0+IGFsaWFzZXMuc29tZShhbGlhcyA9PiBvcHRpb25zW2FsaWFzXSAhPT0gdW5kZWZpbmVkKTtcblxuY29uc3Qgbm9ybWFsaXplU3RkaW8gPSBvcHRpb25zID0+IHtcblx0aWYgKCFvcHRpb25zKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3Qge3N0ZGlvfSA9IG9wdGlvbnM7XG5cblx0aWYgKHN0ZGlvID09PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gYWxpYXNlcy5tYXAoYWxpYXMgPT4gb3B0aW9uc1thbGlhc10pO1xuXHR9XG5cblx0aWYgKGhhc0FsaWFzKG9wdGlvbnMpKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJdCdzIG5vdCBwb3NzaWJsZSB0byBwcm92aWRlIFxcYHN0ZGlvXFxgIGluIGNvbWJpbmF0aW9uIHdpdGggb25lIG9mICR7YWxpYXNlcy5tYXAoYWxpYXMgPT4gYFxcYCR7YWxpYXN9XFxgYCkuam9pbignLCAnKX1gKTtcblx0fVxuXG5cdGlmICh0eXBlb2Ygc3RkaW8gPT09ICdzdHJpbmcnKSB7XG5cdFx0cmV0dXJuIHN0ZGlvO1xuXHR9XG5cblx0aWYgKCFBcnJheS5pc0FycmF5KHN0ZGlvKSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoYEV4cGVjdGVkIFxcYHN0ZGlvXFxgIHRvIGJlIG9mIHR5cGUgXFxgc3RyaW5nXFxgIG9yIFxcYEFycmF5XFxgLCBnb3QgXFxgJHt0eXBlb2Ygc3RkaW99XFxgYCk7XG5cdH1cblxuXHRjb25zdCBsZW5ndGggPSBNYXRoLm1heChzdGRpby5sZW5ndGgsIGFsaWFzZXMubGVuZ3RoKTtcblx0cmV0dXJuIEFycmF5LmZyb20oe2xlbmd0aH0sICh2YWx1ZSwgaW5kZXgpID0+IHN0ZGlvW2luZGV4XSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5vcm1hbGl6ZVN0ZGlvO1xuXG4vLyBgaXBjYCBpcyBwdXNoZWQgdW5sZXNzIGl0IGlzIGFscmVhZHkgcHJlc2VudFxubW9kdWxlLmV4cG9ydHMubm9kZSA9IG9wdGlvbnMgPT4ge1xuXHRjb25zdCBzdGRpbyA9IG5vcm1hbGl6ZVN0ZGlvKG9wdGlvbnMpO1xuXG5cdGlmIChzdGRpbyA9PT0gJ2lwYycpIHtcblx0XHRyZXR1cm4gJ2lwYyc7XG5cdH1cblxuXHRpZiAoc3RkaW8gPT09IHVuZGVmaW5lZCB8fCB0eXBlb2Ygc3RkaW8gPT09ICdzdHJpbmcnKSB7XG5cdFx0cmV0dXJuIFtzdGRpbywgc3RkaW8sIHN0ZGlvLCAnaXBjJ107XG5cdH1cblxuXHRpZiAoc3RkaW8uaW5jbHVkZXMoJ2lwYycpKSB7XG5cdFx0cmV0dXJuIHN0ZGlvO1xuXHR9XG5cblx0cmV0dXJuIFsuLi5zdGRpbywgJ2lwYyddO1xufTtcbiIsIi8vIFRoaXMgaXMgbm90IHRoZSBzZXQgb2YgYWxsIHBvc3NpYmxlIHNpZ25hbHMuXG4vL1xuLy8gSXQgSVMsIGhvd2V2ZXIsIHRoZSBzZXQgb2YgYWxsIHNpZ25hbHMgdGhhdCB0cmlnZ2VyXG4vLyBhbiBleGl0IG9uIGVpdGhlciBMaW51eCBvciBCU0Qgc3lzdGVtcy4gIExpbnV4IGlzIGFcbi8vIHN1cGVyc2V0IG9mIHRoZSBzaWduYWwgbmFtZXMgc3VwcG9ydGVkIG9uIEJTRCwgYW5kXG4vLyB0aGUgdW5rbm93biBzaWduYWxzIGp1c3QgZmFpbCB0byByZWdpc3Rlciwgc28gd2UgY2FuXG4vLyBjYXRjaCB0aGF0IGVhc2lseSBlbm91Z2guXG4vL1xuLy8gRG9uJ3QgYm90aGVyIHdpdGggU0lHS0lMTC4gIEl0J3MgdW5jYXRjaGFibGUsIHdoaWNoXG4vLyBtZWFucyB0aGF0IHdlIGNhbid0IGZpcmUgYW55IGNhbGxiYWNrcyBhbnl3YXkuXG4vL1xuLy8gSWYgYSB1c2VyIGRvZXMgaGFwcGVuIHRvIHJlZ2lzdGVyIGEgaGFuZGxlciBvbiBhIG5vbi1cbi8vIGZhdGFsIHNpZ25hbCBsaWtlIFNJR1dJTkNIIG9yIHNvbWV0aGluZywgYW5kIHRoZW5cbi8vIGV4aXQsIGl0J2xsIGVuZCB1cCBmaXJpbmcgYHByb2Nlc3MuZW1pdCgnZXhpdCcpYCwgc29cbi8vIHRoZSBoYW5kbGVyIHdpbGwgYmUgZmlyZWQgYW55d2F5LlxuLy9cbi8vIFNJR0JVUywgU0lHRlBFLCBTSUdTRUdWIGFuZCBTSUdJTEwsIHdoZW4gbm90IHJhaXNlZFxuLy8gYXJ0aWZpY2lhbGx5LCBpbmhlcmVudGx5IGxlYXZlIHRoZSBwcm9jZXNzIGluIGFcbi8vIHN0YXRlIGZyb20gd2hpY2ggaXQgaXMgbm90IHNhZmUgdG8gdHJ5IGFuZCBlbnRlciBKU1xuLy8gbGlzdGVuZXJzLlxubW9kdWxlLmV4cG9ydHMgPSBbXG4gICdTSUdBQlJUJyxcbiAgJ1NJR0FMUk0nLFxuICAnU0lHSFVQJyxcbiAgJ1NJR0lOVCcsXG4gICdTSUdURVJNJ1xuXVxuXG5pZiAocHJvY2Vzcy5wbGF0Zm9ybSAhPT0gJ3dpbjMyJykge1xuICBtb2R1bGUuZXhwb3J0cy5wdXNoKFxuICAgICdTSUdWVEFMUk0nLFxuICAgICdTSUdYQ1BVJyxcbiAgICAnU0lHWEZTWicsXG4gICAgJ1NJR1VTUjInLFxuICAgICdTSUdUUkFQJyxcbiAgICAnU0lHU1lTJyxcbiAgICAnU0lHUVVJVCcsXG4gICAgJ1NJR0lPVCdcbiAgICAvLyBzaG91bGQgZGV0ZWN0IHByb2ZpbGVyIGFuZCBlbmFibGUvZGlzYWJsZSBhY2NvcmRpbmdseS5cbiAgICAvLyBzZWUgIzIxXG4gICAgLy8gJ1NJR1BST0YnXG4gIClcbn1cblxuaWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICdsaW51eCcpIHtcbiAgbW9kdWxlLmV4cG9ydHMucHVzaChcbiAgICAnU0lHSU8nLFxuICAgICdTSUdQT0xMJyxcbiAgICAnU0lHUFdSJyxcbiAgICAnU0lHU1RLRkxUJyxcbiAgICAnU0lHVU5VU0VEJ1xuICApXG59XG4iLCIvLyBOb3RlOiBzaW5jZSBueWMgdXNlcyB0aGlzIG1vZHVsZSB0byBvdXRwdXQgY292ZXJhZ2UsIGFueSBsaW5lc1xuLy8gdGhhdCBhcmUgaW4gdGhlIGRpcmVjdCBzeW5jIGZsb3cgb2YgbnljJ3Mgb3V0cHV0Q292ZXJhZ2UgYXJlXG4vLyBpZ25vcmVkLCBzaW5jZSB3ZSBjYW4gbmV2ZXIgZ2V0IGNvdmVyYWdlIGZvciB0aGVtLlxuLy8gZ3JhYiBhIHJlZmVyZW5jZSB0byBub2RlJ3MgcmVhbCBwcm9jZXNzIG9iamVjdCByaWdodCBhd2F5XG52YXIgcHJvY2VzcyA9IGdsb2JhbC5wcm9jZXNzXG5cbmNvbnN0IHByb2Nlc3NPayA9IGZ1bmN0aW9uIChwcm9jZXNzKSB7XG4gIHJldHVybiBwcm9jZXNzICYmXG4gICAgdHlwZW9mIHByb2Nlc3MgPT09ICdvYmplY3QnICYmXG4gICAgdHlwZW9mIHByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPT09ICdmdW5jdGlvbicgJiZcbiAgICB0eXBlb2YgcHJvY2Vzcy5lbWl0ID09PSAnZnVuY3Rpb24nICYmXG4gICAgdHlwZW9mIHByb2Nlc3MucmVhbGx5RXhpdCA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgIHR5cGVvZiBwcm9jZXNzLmxpc3RlbmVycyA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgIHR5cGVvZiBwcm9jZXNzLmtpbGwgPT09ICdmdW5jdGlvbicgJiZcbiAgICB0eXBlb2YgcHJvY2Vzcy5waWQgPT09ICdudW1iZXInICYmXG4gICAgdHlwZW9mIHByb2Nlc3Mub24gPT09ICdmdW5jdGlvbidcbn1cblxuLy8gc29tZSBraW5kIG9mIG5vbi1ub2RlIGVudmlyb25tZW50LCBqdXN0IG5vLW9wXG4vKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbmlmICghcHJvY2Vzc09rKHByb2Nlc3MpKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7fVxuICB9XG59IGVsc2Uge1xuICB2YXIgYXNzZXJ0ID0gcmVxdWlyZSgnYXNzZXJ0JylcbiAgdmFyIHNpZ25hbHMgPSByZXF1aXJlKCcuL3NpZ25hbHMuanMnKVxuICB2YXIgaXNXaW4gPSAvXndpbi9pLnRlc3QocHJvY2Vzcy5wbGF0Zm9ybSlcblxuICB2YXIgRUUgPSByZXF1aXJlKCdldmVudHMnKVxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKHR5cGVvZiBFRSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIEVFID0gRUUuRXZlbnRFbWl0dGVyXG4gIH1cblxuICB2YXIgZW1pdHRlclxuICBpZiAocHJvY2Vzcy5fX3NpZ25hbF9leGl0X2VtaXR0ZXJfXykge1xuICAgIGVtaXR0ZXIgPSBwcm9jZXNzLl9fc2lnbmFsX2V4aXRfZW1pdHRlcl9fXG4gIH0gZWxzZSB7XG4gICAgZW1pdHRlciA9IHByb2Nlc3MuX19zaWduYWxfZXhpdF9lbWl0dGVyX18gPSBuZXcgRUUoKVxuICAgIGVtaXR0ZXIuY291bnQgPSAwXG4gICAgZW1pdHRlci5lbWl0dGVkID0ge31cbiAgfVxuXG4gIC8vIEJlY2F1c2UgdGhpcyBlbWl0dGVyIGlzIGEgZ2xvYmFsLCB3ZSBoYXZlIHRvIGNoZWNrIHRvIHNlZSBpZiBhXG4gIC8vIHByZXZpb3VzIHZlcnNpb24gb2YgdGhpcyBsaWJyYXJ5IGZhaWxlZCB0byBlbmFibGUgaW5maW5pdGUgbGlzdGVuZXJzLlxuICAvLyBJIGtub3cgd2hhdCB5b3UncmUgYWJvdXQgdG8gc2F5LiAgQnV0IGxpdGVyYWxseSBldmVyeXRoaW5nIGFib3V0XG4gIC8vIHNpZ25hbC1leGl0IGlzIGEgY29tcHJvbWlzZSB3aXRoIGV2aWwuICBHZXQgdXNlZCB0byBpdC5cbiAgaWYgKCFlbWl0dGVyLmluZmluaXRlKSB7XG4gICAgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoSW5maW5pdHkpXG4gICAgZW1pdHRlci5pbmZpbml0ZSA9IHRydWVcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGNiLCBvcHRzKSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKCFwcm9jZXNzT2soZ2xvYmFsLnByb2Nlc3MpKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKCkge31cbiAgICB9XG4gICAgYXNzZXJ0LmVxdWFsKHR5cGVvZiBjYiwgJ2Z1bmN0aW9uJywgJ2EgY2FsbGJhY2sgbXVzdCBiZSBwcm92aWRlZCBmb3IgZXhpdCBoYW5kbGVyJylcblxuICAgIGlmIChsb2FkZWQgPT09IGZhbHNlKSB7XG4gICAgICBsb2FkKClcbiAgICB9XG5cbiAgICB2YXIgZXYgPSAnZXhpdCdcbiAgICBpZiAob3B0cyAmJiBvcHRzLmFsd2F5c0xhc3QpIHtcbiAgICAgIGV2ID0gJ2FmdGVyZXhpdCdcbiAgICB9XG5cbiAgICB2YXIgcmVtb3ZlID0gZnVuY3Rpb24gKCkge1xuICAgICAgZW1pdHRlci5yZW1vdmVMaXN0ZW5lcihldiwgY2IpXG4gICAgICBpZiAoZW1pdHRlci5saXN0ZW5lcnMoJ2V4aXQnKS5sZW5ndGggPT09IDAgJiZcbiAgICAgICAgICBlbWl0dGVyLmxpc3RlbmVycygnYWZ0ZXJleGl0JykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHVubG9hZCgpXG4gICAgICB9XG4gICAgfVxuICAgIGVtaXR0ZXIub24oZXYsIGNiKVxuXG4gICAgcmV0dXJuIHJlbW92ZVxuICB9XG5cbiAgdmFyIHVubG9hZCA9IGZ1bmN0aW9uIHVubG9hZCAoKSB7XG4gICAgaWYgKCFsb2FkZWQgfHwgIXByb2Nlc3NPayhnbG9iYWwucHJvY2VzcykpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBsb2FkZWQgPSBmYWxzZVxuXG4gICAgc2lnbmFscy5mb3JFYWNoKGZ1bmN0aW9uIChzaWcpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHByb2Nlc3MucmVtb3ZlTGlzdGVuZXIoc2lnLCBzaWdMaXN0ZW5lcnNbc2lnXSlcbiAgICAgIH0gY2F0Y2ggKGVyKSB7fVxuICAgIH0pXG4gICAgcHJvY2Vzcy5lbWl0ID0gb3JpZ2luYWxQcm9jZXNzRW1pdFxuICAgIHByb2Nlc3MucmVhbGx5RXhpdCA9IG9yaWdpbmFsUHJvY2Vzc1JlYWxseUV4aXRcbiAgICBlbWl0dGVyLmNvdW50IC09IDFcbiAgfVxuICBtb2R1bGUuZXhwb3J0cy51bmxvYWQgPSB1bmxvYWRcblxuICB2YXIgZW1pdCA9IGZ1bmN0aW9uIGVtaXQgKGV2ZW50LCBjb2RlLCBzaWduYWwpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAoZW1pdHRlci5lbWl0dGVkW2V2ZW50XSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGVtaXR0ZXIuZW1pdHRlZFtldmVudF0gPSB0cnVlXG4gICAgZW1pdHRlci5lbWl0KGV2ZW50LCBjb2RlLCBzaWduYWwpXG4gIH1cblxuICAvLyB7IDxzaWduYWw+OiA8bGlzdGVuZXIgZm4+LCAuLi4gfVxuICB2YXIgc2lnTGlzdGVuZXJzID0ge31cbiAgc2lnbmFscy5mb3JFYWNoKGZ1bmN0aW9uIChzaWcpIHtcbiAgICBzaWdMaXN0ZW5lcnNbc2lnXSA9IGZ1bmN0aW9uIGxpc3RlbmVyICgpIHtcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKCFwcm9jZXNzT2soZ2xvYmFsLnByb2Nlc3MpKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgLy8gSWYgdGhlcmUgYXJlIG5vIG90aGVyIGxpc3RlbmVycywgYW4gZXhpdCBpcyBjb21pbmchXG4gICAgICAvLyBTaW1wbGVzdCB3YXk6IHJlbW92ZSB1cyBhbmQgdGhlbiByZS1zZW5kIHRoZSBzaWduYWwuXG4gICAgICAvLyBXZSBrbm93IHRoYXQgdGhpcyB3aWxsIGtpbGwgdGhlIHByb2Nlc3MsIHNvIHdlIGNhblxuICAgICAgLy8gc2FmZWx5IGVtaXQgbm93LlxuICAgICAgdmFyIGxpc3RlbmVycyA9IHByb2Nlc3MubGlzdGVuZXJzKHNpZylcbiAgICAgIGlmIChsaXN0ZW5lcnMubGVuZ3RoID09PSBlbWl0dGVyLmNvdW50KSB7XG4gICAgICAgIHVubG9hZCgpXG4gICAgICAgIGVtaXQoJ2V4aXQnLCBudWxsLCBzaWcpXG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICAgIGVtaXQoJ2FmdGVyZXhpdCcsIG51bGwsIHNpZylcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgaWYgKGlzV2luICYmIHNpZyA9PT0gJ1NJR0hVUCcpIHtcbiAgICAgICAgICAvLyBcIlNJR0hVUFwiIHRocm93cyBhbiBgRU5PU1lTYCBlcnJvciBvbiBXaW5kb3dzLFxuICAgICAgICAgIC8vIHNvIHVzZSBhIHN1cHBvcnRlZCBzaWduYWwgaW5zdGVhZFxuICAgICAgICAgIHNpZyA9ICdTSUdJTlQnXG4gICAgICAgIH1cbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgcHJvY2Vzcy5raWxsKHByb2Nlc3MucGlkLCBzaWcpXG4gICAgICB9XG4gICAgfVxuICB9KVxuXG4gIG1vZHVsZS5leHBvcnRzLnNpZ25hbHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHNpZ25hbHNcbiAgfVxuXG4gIHZhciBsb2FkZWQgPSBmYWxzZVxuXG4gIHZhciBsb2FkID0gZnVuY3Rpb24gbG9hZCAoKSB7XG4gICAgaWYgKGxvYWRlZCB8fCAhcHJvY2Vzc09rKGdsb2JhbC5wcm9jZXNzKSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGxvYWRlZCA9IHRydWVcblxuICAgIC8vIFRoaXMgaXMgdGhlIG51bWJlciBvZiBvblNpZ25hbEV4aXQncyB0aGF0IGFyZSBpbiBwbGF5LlxuICAgIC8vIEl0J3MgaW1wb3J0YW50IHNvIHRoYXQgd2UgY2FuIGNvdW50IHRoZSBjb3JyZWN0IG51bWJlciBvZlxuICAgIC8vIGxpc3RlbmVycyBvbiBzaWduYWxzLCBhbmQgZG9uJ3Qgd2FpdCBmb3IgdGhlIG90aGVyIG9uZSB0b1xuICAgIC8vIGhhbmRsZSBpdCBpbnN0ZWFkIG9mIHVzLlxuICAgIGVtaXR0ZXIuY291bnQgKz0gMVxuXG4gICAgc2lnbmFscyA9IHNpZ25hbHMuZmlsdGVyKGZ1bmN0aW9uIChzaWcpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHByb2Nlc3Mub24oc2lnLCBzaWdMaXN0ZW5lcnNbc2lnXSlcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH0gY2F0Y2ggKGVyKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgIH0pXG5cbiAgICBwcm9jZXNzLmVtaXQgPSBwcm9jZXNzRW1pdFxuICAgIHByb2Nlc3MucmVhbGx5RXhpdCA9IHByb2Nlc3NSZWFsbHlFeGl0XG4gIH1cbiAgbW9kdWxlLmV4cG9ydHMubG9hZCA9IGxvYWRcblxuICB2YXIgb3JpZ2luYWxQcm9jZXNzUmVhbGx5RXhpdCA9IHByb2Nlc3MucmVhbGx5RXhpdFxuICB2YXIgcHJvY2Vzc1JlYWxseUV4aXQgPSBmdW5jdGlvbiBwcm9jZXNzUmVhbGx5RXhpdCAoY29kZSkge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmICghcHJvY2Vzc09rKGdsb2JhbC5wcm9jZXNzKSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIHByb2Nlc3MuZXhpdENvZGUgPSBjb2RlIHx8IC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovIDBcbiAgICBlbWl0KCdleGl0JywgcHJvY2Vzcy5leGl0Q29kZSwgbnVsbClcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGVtaXQoJ2FmdGVyZXhpdCcsIHByb2Nlc3MuZXhpdENvZGUsIG51bGwpXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBvcmlnaW5hbFByb2Nlc3NSZWFsbHlFeGl0LmNhbGwocHJvY2VzcywgcHJvY2Vzcy5leGl0Q29kZSlcbiAgfVxuXG4gIHZhciBvcmlnaW5hbFByb2Nlc3NFbWl0ID0gcHJvY2Vzcy5lbWl0XG4gIHZhciBwcm9jZXNzRW1pdCA9IGZ1bmN0aW9uIHByb2Nlc3NFbWl0IChldiwgYXJnKSB7XG4gICAgaWYgKGV2ID09PSAnZXhpdCcgJiYgcHJvY2Vzc09rKGdsb2JhbC5wcm9jZXNzKSkge1xuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICAgIGlmIChhcmcgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwcm9jZXNzLmV4aXRDb2RlID0gYXJnXG4gICAgICB9XG4gICAgICB2YXIgcmV0ID0gb3JpZ2luYWxQcm9jZXNzRW1pdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgZW1pdCgnZXhpdCcsIHByb2Nlc3MuZXhpdENvZGUsIG51bGwpXG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgZW1pdCgnYWZ0ZXJleGl0JywgcHJvY2Vzcy5leGl0Q29kZSwgbnVsbClcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICByZXR1cm4gcmV0XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBvcmlnaW5hbFByb2Nlc3NFbWl0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbiAgICB9XG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcbmNvbnN0IG9zID0gcmVxdWlyZSgnb3MnKTtcbmNvbnN0IG9uRXhpdCA9IHJlcXVpcmUoJ3NpZ25hbC1leGl0Jyk7XG5cbmNvbnN0IERFRkFVTFRfRk9SQ0VfS0lMTF9USU1FT1VUID0gMTAwMCAqIDU7XG5cbi8vIE1vbmtleS1wYXRjaGVzIGBjaGlsZFByb2Nlc3Mua2lsbCgpYCB0byBhZGQgYGZvcmNlS2lsbEFmdGVyVGltZW91dGAgYmVoYXZpb3JcbmNvbnN0IHNwYXduZWRLaWxsID0gKGtpbGwsIHNpZ25hbCA9ICdTSUdURVJNJywgb3B0aW9ucyA9IHt9KSA9PiB7XG5cdGNvbnN0IGtpbGxSZXN1bHQgPSBraWxsKHNpZ25hbCk7XG5cdHNldEtpbGxUaW1lb3V0KGtpbGwsIHNpZ25hbCwgb3B0aW9ucywga2lsbFJlc3VsdCk7XG5cdHJldHVybiBraWxsUmVzdWx0O1xufTtcblxuY29uc3Qgc2V0S2lsbFRpbWVvdXQgPSAoa2lsbCwgc2lnbmFsLCBvcHRpb25zLCBraWxsUmVzdWx0KSA9PiB7XG5cdGlmICghc2hvdWxkRm9yY2VLaWxsKHNpZ25hbCwgb3B0aW9ucywga2lsbFJlc3VsdCkpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRjb25zdCB0aW1lb3V0ID0gZ2V0Rm9yY2VLaWxsQWZ0ZXJUaW1lb3V0KG9wdGlvbnMpO1xuXHRjb25zdCB0ID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0a2lsbCgnU0lHS0lMTCcpO1xuXHR9LCB0aW1lb3V0KTtcblxuXHQvLyBHdWFyZGVkIGJlY2F1c2UgdGhlcmUncyBubyBgLnVucmVmKClgIHdoZW4gYGV4ZWNhYCBpcyB1c2VkIGluIHRoZSByZW5kZXJlclxuXHQvLyBwcm9jZXNzIGluIEVsZWN0cm9uLiBUaGlzIGNhbm5vdCBiZSB0ZXN0ZWQgc2luY2Ugd2UgZG9uJ3QgcnVuIHRlc3RzIGluXG5cdC8vIEVsZWN0cm9uLlxuXHQvLyBpc3RhbmJ1bCBpZ25vcmUgZWxzZVxuXHRpZiAodC51bnJlZikge1xuXHRcdHQudW5yZWYoKTtcblx0fVxufTtcblxuY29uc3Qgc2hvdWxkRm9yY2VLaWxsID0gKHNpZ25hbCwge2ZvcmNlS2lsbEFmdGVyVGltZW91dH0sIGtpbGxSZXN1bHQpID0+IHtcblx0cmV0dXJuIGlzU2lndGVybShzaWduYWwpICYmIGZvcmNlS2lsbEFmdGVyVGltZW91dCAhPT0gZmFsc2UgJiYga2lsbFJlc3VsdDtcbn07XG5cbmNvbnN0IGlzU2lndGVybSA9IHNpZ25hbCA9PiB7XG5cdHJldHVybiBzaWduYWwgPT09IG9zLmNvbnN0YW50cy5zaWduYWxzLlNJR1RFUk0gfHxcblx0XHQodHlwZW9mIHNpZ25hbCA9PT0gJ3N0cmluZycgJiYgc2lnbmFsLnRvVXBwZXJDYXNlKCkgPT09ICdTSUdURVJNJyk7XG59O1xuXG5jb25zdCBnZXRGb3JjZUtpbGxBZnRlclRpbWVvdXQgPSAoe2ZvcmNlS2lsbEFmdGVyVGltZW91dCA9IHRydWV9KSA9PiB7XG5cdGlmIChmb3JjZUtpbGxBZnRlclRpbWVvdXQgPT09IHRydWUpIHtcblx0XHRyZXR1cm4gREVGQVVMVF9GT1JDRV9LSUxMX1RJTUVPVVQ7XG5cdH1cblxuXHRpZiAoIU51bWJlci5pc0Zpbml0ZShmb3JjZUtpbGxBZnRlclRpbWVvdXQpIHx8IGZvcmNlS2lsbEFmdGVyVGltZW91dCA8IDApIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGBFeHBlY3RlZCB0aGUgXFxgZm9yY2VLaWxsQWZ0ZXJUaW1lb3V0XFxgIG9wdGlvbiB0byBiZSBhIG5vbi1uZWdhdGl2ZSBpbnRlZ2VyLCBnb3QgXFxgJHtmb3JjZUtpbGxBZnRlclRpbWVvdXR9XFxgICgke3R5cGVvZiBmb3JjZUtpbGxBZnRlclRpbWVvdXR9KWApO1xuXHR9XG5cblx0cmV0dXJuIGZvcmNlS2lsbEFmdGVyVGltZW91dDtcbn07XG5cbi8vIGBjaGlsZFByb2Nlc3MuY2FuY2VsKClgXG5jb25zdCBzcGF3bmVkQ2FuY2VsID0gKHNwYXduZWQsIGNvbnRleHQpID0+IHtcblx0Y29uc3Qga2lsbFJlc3VsdCA9IHNwYXduZWQua2lsbCgpO1xuXG5cdGlmIChraWxsUmVzdWx0KSB7XG5cdFx0Y29udGV4dC5pc0NhbmNlbGVkID0gdHJ1ZTtcblx0fVxufTtcblxuY29uc3QgdGltZW91dEtpbGwgPSAoc3Bhd25lZCwgc2lnbmFsLCByZWplY3QpID0+IHtcblx0c3Bhd25lZC5raWxsKHNpZ25hbCk7XG5cdHJlamVjdChPYmplY3QuYXNzaWduKG5ldyBFcnJvcignVGltZWQgb3V0JyksIHt0aW1lZE91dDogdHJ1ZSwgc2lnbmFsfSkpO1xufTtcblxuLy8gYHRpbWVvdXRgIG9wdGlvbiBoYW5kbGluZ1xuY29uc3Qgc2V0dXBUaW1lb3V0ID0gKHNwYXduZWQsIHt0aW1lb3V0LCBraWxsU2lnbmFsID0gJ1NJR1RFUk0nfSwgc3Bhd25lZFByb21pc2UpID0+IHtcblx0aWYgKHRpbWVvdXQgPT09IDAgfHwgdGltZW91dCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIHNwYXduZWRQcm9taXNlO1xuXHR9XG5cblx0bGV0IHRpbWVvdXRJZDtcblx0Y29uc3QgdGltZW91dFByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0dGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aW1lb3V0S2lsbChzcGF3bmVkLCBraWxsU2lnbmFsLCByZWplY3QpO1xuXHRcdH0sIHRpbWVvdXQpO1xuXHR9KTtcblxuXHRjb25zdCBzYWZlU3Bhd25lZFByb21pc2UgPSBzcGF3bmVkUHJvbWlzZS5maW5hbGx5KCgpID0+IHtcblx0XHRjbGVhclRpbWVvdXQodGltZW91dElkKTtcblx0fSk7XG5cblx0cmV0dXJuIFByb21pc2UucmFjZShbdGltZW91dFByb21pc2UsIHNhZmVTcGF3bmVkUHJvbWlzZV0pO1xufTtcblxuY29uc3QgdmFsaWRhdGVUaW1lb3V0ID0gKHt0aW1lb3V0fSkgPT4ge1xuXHRpZiAodGltZW91dCAhPT0gdW5kZWZpbmVkICYmICghTnVtYmVyLmlzRmluaXRlKHRpbWVvdXQpIHx8IHRpbWVvdXQgPCAwKSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoYEV4cGVjdGVkIHRoZSBcXGB0aW1lb3V0XFxgIG9wdGlvbiB0byBiZSBhIG5vbi1uZWdhdGl2ZSBpbnRlZ2VyLCBnb3QgXFxgJHt0aW1lb3V0fVxcYCAoJHt0eXBlb2YgdGltZW91dH0pYCk7XG5cdH1cbn07XG5cbi8vIGBjbGVhbnVwYCBvcHRpb24gaGFuZGxpbmdcbmNvbnN0IHNldEV4aXRIYW5kbGVyID0gYXN5bmMgKHNwYXduZWQsIHtjbGVhbnVwLCBkZXRhY2hlZH0sIHRpbWVkUHJvbWlzZSkgPT4ge1xuXHRpZiAoIWNsZWFudXAgfHwgZGV0YWNoZWQpIHtcblx0XHRyZXR1cm4gdGltZWRQcm9taXNlO1xuXHR9XG5cblx0Y29uc3QgcmVtb3ZlRXhpdEhhbmRsZXIgPSBvbkV4aXQoKCkgPT4ge1xuXHRcdHNwYXduZWQua2lsbCgpO1xuXHR9KTtcblxuXHRyZXR1cm4gdGltZWRQcm9taXNlLmZpbmFsbHkoKCkgPT4ge1xuXHRcdHJlbW92ZUV4aXRIYW5kbGVyKCk7XG5cdH0pO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdHNwYXduZWRLaWxsLFxuXHRzcGF3bmVkQ2FuY2VsLFxuXHRzZXR1cFRpbWVvdXQsXG5cdHZhbGlkYXRlVGltZW91dCxcblx0c2V0RXhpdEhhbmRsZXJcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGlzU3RyZWFtID0gc3RyZWFtID0+XG5cdHN0cmVhbSAhPT0gbnVsbCAmJlxuXHR0eXBlb2Ygc3RyZWFtID09PSAnb2JqZWN0JyAmJlxuXHR0eXBlb2Ygc3RyZWFtLnBpcGUgPT09ICdmdW5jdGlvbic7XG5cbmlzU3RyZWFtLndyaXRhYmxlID0gc3RyZWFtID0+XG5cdGlzU3RyZWFtKHN0cmVhbSkgJiZcblx0c3RyZWFtLndyaXRhYmxlICE9PSBmYWxzZSAmJlxuXHR0eXBlb2Ygc3RyZWFtLl93cml0ZSA9PT0gJ2Z1bmN0aW9uJyAmJlxuXHR0eXBlb2Ygc3RyZWFtLl93cml0YWJsZVN0YXRlID09PSAnb2JqZWN0JztcblxuaXNTdHJlYW0ucmVhZGFibGUgPSBzdHJlYW0gPT5cblx0aXNTdHJlYW0oc3RyZWFtKSAmJlxuXHRzdHJlYW0ucmVhZGFibGUgIT09IGZhbHNlICYmXG5cdHR5cGVvZiBzdHJlYW0uX3JlYWQgPT09ICdmdW5jdGlvbicgJiZcblx0dHlwZW9mIHN0cmVhbS5fcmVhZGFibGVTdGF0ZSA9PT0gJ29iamVjdCc7XG5cbmlzU3RyZWFtLmR1cGxleCA9IHN0cmVhbSA9PlxuXHRpc1N0cmVhbS53cml0YWJsZShzdHJlYW0pICYmXG5cdGlzU3RyZWFtLnJlYWRhYmxlKHN0cmVhbSk7XG5cbmlzU3RyZWFtLnRyYW5zZm9ybSA9IHN0cmVhbSA9PlxuXHRpc1N0cmVhbS5kdXBsZXgoc3RyZWFtKSAmJlxuXHR0eXBlb2Ygc3RyZWFtLl90cmFuc2Zvcm0gPT09ICdmdW5jdGlvbic7XG5cbm1vZHVsZS5leHBvcnRzID0gaXNTdHJlYW07XG4iLCIndXNlIHN0cmljdCc7XG5jb25zdCB7UGFzc1Rocm91Z2g6IFBhc3NUaHJvdWdoU3RyZWFtfSA9IHJlcXVpcmUoJ3N0cmVhbScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IG9wdGlvbnMgPT4ge1xuXHRvcHRpb25zID0gey4uLm9wdGlvbnN9O1xuXG5cdGNvbnN0IHthcnJheX0gPSBvcHRpb25zO1xuXHRsZXQge2VuY29kaW5nfSA9IG9wdGlvbnM7XG5cdGNvbnN0IGlzQnVmZmVyID0gZW5jb2RpbmcgPT09ICdidWZmZXInO1xuXHRsZXQgb2JqZWN0TW9kZSA9IGZhbHNlO1xuXG5cdGlmIChhcnJheSkge1xuXHRcdG9iamVjdE1vZGUgPSAhKGVuY29kaW5nIHx8IGlzQnVmZmVyKTtcblx0fSBlbHNlIHtcblx0XHRlbmNvZGluZyA9IGVuY29kaW5nIHx8ICd1dGY4Jztcblx0fVxuXG5cdGlmIChpc0J1ZmZlcikge1xuXHRcdGVuY29kaW5nID0gbnVsbDtcblx0fVxuXG5cdGNvbnN0IHN0cmVhbSA9IG5ldyBQYXNzVGhyb3VnaFN0cmVhbSh7b2JqZWN0TW9kZX0pO1xuXG5cdGlmIChlbmNvZGluZykge1xuXHRcdHN0cmVhbS5zZXRFbmNvZGluZyhlbmNvZGluZyk7XG5cdH1cblxuXHRsZXQgbGVuZ3RoID0gMDtcblx0Y29uc3QgY2h1bmtzID0gW107XG5cblx0c3RyZWFtLm9uKCdkYXRhJywgY2h1bmsgPT4ge1xuXHRcdGNodW5rcy5wdXNoKGNodW5rKTtcblxuXHRcdGlmIChvYmplY3RNb2RlKSB7XG5cdFx0XHRsZW5ndGggPSBjaHVua3MubGVuZ3RoO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRsZW5ndGggKz0gY2h1bmsubGVuZ3RoO1xuXHRcdH1cblx0fSk7XG5cblx0c3RyZWFtLmdldEJ1ZmZlcmVkVmFsdWUgPSAoKSA9PiB7XG5cdFx0aWYgKGFycmF5KSB7XG5cdFx0XHRyZXR1cm4gY2h1bmtzO1xuXHRcdH1cblxuXHRcdHJldHVybiBpc0J1ZmZlciA/IEJ1ZmZlci5jb25jYXQoY2h1bmtzLCBsZW5ndGgpIDogY2h1bmtzLmpvaW4oJycpO1xuXHR9O1xuXG5cdHN0cmVhbS5nZXRCdWZmZXJlZExlbmd0aCA9ICgpID0+IGxlbmd0aDtcblxuXHRyZXR1cm4gc3RyZWFtO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcbmNvbnN0IHtjb25zdGFudHM6IEJ1ZmZlckNvbnN0YW50c30gPSByZXF1aXJlKCdidWZmZXInKTtcbmNvbnN0IHN0cmVhbSA9IHJlcXVpcmUoJ3N0cmVhbScpO1xuY29uc3Qge3Byb21pc2lmeX0gPSByZXF1aXJlKCd1dGlsJyk7XG5jb25zdCBidWZmZXJTdHJlYW0gPSByZXF1aXJlKCcuL2J1ZmZlci1zdHJlYW0nKTtcblxuY29uc3Qgc3RyZWFtUGlwZWxpbmVQcm9taXNpZmllZCA9IHByb21pc2lmeShzdHJlYW0ucGlwZWxpbmUpO1xuXG5jbGFzcyBNYXhCdWZmZXJFcnJvciBleHRlbmRzIEVycm9yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoJ21heEJ1ZmZlciBleGNlZWRlZCcpO1xuXHRcdHRoaXMubmFtZSA9ICdNYXhCdWZmZXJFcnJvcic7XG5cdH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0U3RyZWFtKGlucHV0U3RyZWFtLCBvcHRpb25zKSB7XG5cdGlmICghaW5wdXRTdHJlYW0pIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIGEgc3RyZWFtJyk7XG5cdH1cblxuXHRvcHRpb25zID0ge1xuXHRcdG1heEJ1ZmZlcjogSW5maW5pdHksXG5cdFx0Li4ub3B0aW9uc1xuXHR9O1xuXG5cdGNvbnN0IHttYXhCdWZmZXJ9ID0gb3B0aW9ucztcblx0Y29uc3Qgc3RyZWFtID0gYnVmZmVyU3RyZWFtKG9wdGlvbnMpO1xuXG5cdGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRjb25zdCByZWplY3RQcm9taXNlID0gZXJyb3IgPT4ge1xuXHRcdFx0Ly8gRG9uJ3QgcmV0cmlldmUgYW4gb3ZlcnNpemVkIGJ1ZmZlci5cblx0XHRcdGlmIChlcnJvciAmJiBzdHJlYW0uZ2V0QnVmZmVyZWRMZW5ndGgoKSA8PSBCdWZmZXJDb25zdGFudHMuTUFYX0xFTkdUSCkge1xuXHRcdFx0XHRlcnJvci5idWZmZXJlZERhdGEgPSBzdHJlYW0uZ2V0QnVmZmVyZWRWYWx1ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZWplY3QoZXJyb3IpO1xuXHRcdH07XG5cblx0XHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgc3RyZWFtUGlwZWxpbmVQcm9taXNpZmllZChpbnB1dFN0cmVhbSwgc3RyZWFtKTtcblx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0cmVqZWN0UHJvbWlzZShlcnJvcik7XG5cdFx0XHR9XG5cdFx0fSkoKTtcblxuXHRcdHN0cmVhbS5vbignZGF0YScsICgpID0+IHtcblx0XHRcdGlmIChzdHJlYW0uZ2V0QnVmZmVyZWRMZW5ndGgoKSA+IG1heEJ1ZmZlcikge1xuXHRcdFx0XHRyZWplY3RQcm9taXNlKG5ldyBNYXhCdWZmZXJFcnJvcigpKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0cmV0dXJuIHN0cmVhbS5nZXRCdWZmZXJlZFZhbHVlKCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0U3RyZWFtO1xubW9kdWxlLmV4cG9ydHMuYnVmZmVyID0gKHN0cmVhbSwgb3B0aW9ucykgPT4gZ2V0U3RyZWFtKHN0cmVhbSwgey4uLm9wdGlvbnMsIGVuY29kaW5nOiAnYnVmZmVyJ30pO1xubW9kdWxlLmV4cG9ydHMuYXJyYXkgPSAoc3RyZWFtLCBvcHRpb25zKSA9PiBnZXRTdHJlYW0oc3RyZWFtLCB7Li4ub3B0aW9ucywgYXJyYXk6IHRydWV9KTtcbm1vZHVsZS5leHBvcnRzLk1heEJ1ZmZlckVycm9yID0gTWF4QnVmZmVyRXJyb3I7XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IHsgUGFzc1Rocm91Z2ggfSA9IHJlcXVpcmUoJ3N0cmVhbScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgvKnN0cmVhbXMuLi4qLykge1xuICB2YXIgc291cmNlcyA9IFtdXG4gIHZhciBvdXRwdXQgID0gbmV3IFBhc3NUaHJvdWdoKHtvYmplY3RNb2RlOiB0cnVlfSlcblxuICBvdXRwdXQuc2V0TWF4TGlzdGVuZXJzKDApXG5cbiAgb3V0cHV0LmFkZCA9IGFkZFxuICBvdXRwdXQuaXNFbXB0eSA9IGlzRW1wdHlcblxuICBvdXRwdXQub24oJ3VucGlwZScsIHJlbW92ZSlcblxuICBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpLmZvckVhY2goYWRkKVxuXG4gIHJldHVybiBvdXRwdXRcblxuICBmdW5jdGlvbiBhZGQgKHNvdXJjZSkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KHNvdXJjZSkpIHtcbiAgICAgIHNvdXJjZS5mb3JFYWNoKGFkZClcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfVxuXG4gICAgc291cmNlcy5wdXNoKHNvdXJjZSk7XG4gICAgc291cmNlLm9uY2UoJ2VuZCcsIHJlbW92ZS5iaW5kKG51bGwsIHNvdXJjZSkpXG4gICAgc291cmNlLm9uY2UoJ2Vycm9yJywgb3V0cHV0LmVtaXQuYmluZChvdXRwdXQsICdlcnJvcicpKVxuICAgIHNvdXJjZS5waXBlKG91dHB1dCwge2VuZDogZmFsc2V9KVxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBmdW5jdGlvbiBpc0VtcHR5ICgpIHtcbiAgICByZXR1cm4gc291cmNlcy5sZW5ndGggPT0gMDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZSAoc291cmNlKSB7XG4gICAgc291cmNlcyA9IHNvdXJjZXMuZmlsdGVyKGZ1bmN0aW9uIChpdCkgeyByZXR1cm4gaXQgIT09IHNvdXJjZSB9KVxuICAgIGlmICghc291cmNlcy5sZW5ndGggJiYgb3V0cHV0LnJlYWRhYmxlKSB7IG91dHB1dC5lbmQoKSB9XG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcbmNvbnN0IGlzU3RyZWFtID0gcmVxdWlyZSgnaXMtc3RyZWFtJyk7XG5jb25zdCBnZXRTdHJlYW0gPSByZXF1aXJlKCdnZXQtc3RyZWFtJyk7XG5jb25zdCBtZXJnZVN0cmVhbSA9IHJlcXVpcmUoJ21lcmdlLXN0cmVhbScpO1xuXG4vLyBgaW5wdXRgIG9wdGlvblxuY29uc3QgaGFuZGxlSW5wdXQgPSAoc3Bhd25lZCwgaW5wdXQpID0+IHtcblx0Ly8gQ2hlY2tpbmcgZm9yIHN0ZGluIGlzIHdvcmthcm91bmQgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9pc3N1ZXMvMjY4NTJcblx0Ly8gQHRvZG8gcmVtb3ZlIGB8fCBzcGF3bmVkLnN0ZGluID09PSB1bmRlZmluZWRgIG9uY2Ugd2UgZHJvcCBzdXBwb3J0IGZvciBOb2RlLmpzIDw9MTIuMi4wXG5cdGlmIChpbnB1dCA9PT0gdW5kZWZpbmVkIHx8IHNwYXduZWQuc3RkaW4gPT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGlmIChpc1N0cmVhbShpbnB1dCkpIHtcblx0XHRpbnB1dC5waXBlKHNwYXduZWQuc3RkaW4pO1xuXHR9IGVsc2Uge1xuXHRcdHNwYXduZWQuc3RkaW4uZW5kKGlucHV0KTtcblx0fVxufTtcblxuLy8gYGFsbGAgaW50ZXJsZWF2ZXMgYHN0ZG91dGAgYW5kIGBzdGRlcnJgXG5jb25zdCBtYWtlQWxsU3RyZWFtID0gKHNwYXduZWQsIHthbGx9KSA9PiB7XG5cdGlmICghYWxsIHx8ICghc3Bhd25lZC5zdGRvdXQgJiYgIXNwYXduZWQuc3RkZXJyKSkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IG1peGVkID0gbWVyZ2VTdHJlYW0oKTtcblxuXHRpZiAoc3Bhd25lZC5zdGRvdXQpIHtcblx0XHRtaXhlZC5hZGQoc3Bhd25lZC5zdGRvdXQpO1xuXHR9XG5cblx0aWYgKHNwYXduZWQuc3RkZXJyKSB7XG5cdFx0bWl4ZWQuYWRkKHNwYXduZWQuc3RkZXJyKTtcblx0fVxuXG5cdHJldHVybiBtaXhlZDtcbn07XG5cbi8vIE9uIGZhaWx1cmUsIGByZXN1bHQuc3Rkb3V0fHN0ZGVycnxhbGxgIHNob3VsZCBjb250YWluIHRoZSBjdXJyZW50bHkgYnVmZmVyZWQgc3RyZWFtXG5jb25zdCBnZXRCdWZmZXJlZERhdGEgPSBhc3luYyAoc3RyZWFtLCBzdHJlYW1Qcm9taXNlKSA9PiB7XG5cdGlmICghc3RyZWFtKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0c3RyZWFtLmRlc3Ryb3koKTtcblxuXHR0cnkge1xuXHRcdHJldHVybiBhd2FpdCBzdHJlYW1Qcm9taXNlO1xuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdHJldHVybiBlcnJvci5idWZmZXJlZERhdGE7XG5cdH1cbn07XG5cbmNvbnN0IGdldFN0cmVhbVByb21pc2UgPSAoc3RyZWFtLCB7ZW5jb2RpbmcsIGJ1ZmZlciwgbWF4QnVmZmVyfSkgPT4ge1xuXHRpZiAoIXN0cmVhbSB8fCAhYnVmZmVyKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0aWYgKGVuY29kaW5nKSB7XG5cdFx0cmV0dXJuIGdldFN0cmVhbShzdHJlYW0sIHtlbmNvZGluZywgbWF4QnVmZmVyfSk7XG5cdH1cblxuXHRyZXR1cm4gZ2V0U3RyZWFtLmJ1ZmZlcihzdHJlYW0sIHttYXhCdWZmZXJ9KTtcbn07XG5cbi8vIFJldHJpZXZlIHJlc3VsdCBvZiBjaGlsZCBwcm9jZXNzOiBleGl0IGNvZGUsIHNpZ25hbCwgZXJyb3IsIHN0cmVhbXMgKHN0ZG91dC9zdGRlcnIvYWxsKVxuY29uc3QgZ2V0U3Bhd25lZFJlc3VsdCA9IGFzeW5jICh7c3Rkb3V0LCBzdGRlcnIsIGFsbH0sIHtlbmNvZGluZywgYnVmZmVyLCBtYXhCdWZmZXJ9LCBwcm9jZXNzRG9uZSkgPT4ge1xuXHRjb25zdCBzdGRvdXRQcm9taXNlID0gZ2V0U3RyZWFtUHJvbWlzZShzdGRvdXQsIHtlbmNvZGluZywgYnVmZmVyLCBtYXhCdWZmZXJ9KTtcblx0Y29uc3Qgc3RkZXJyUHJvbWlzZSA9IGdldFN0cmVhbVByb21pc2Uoc3RkZXJyLCB7ZW5jb2RpbmcsIGJ1ZmZlciwgbWF4QnVmZmVyfSk7XG5cdGNvbnN0IGFsbFByb21pc2UgPSBnZXRTdHJlYW1Qcm9taXNlKGFsbCwge2VuY29kaW5nLCBidWZmZXIsIG1heEJ1ZmZlcjogbWF4QnVmZmVyICogMn0pO1xuXG5cdHRyeSB7XG5cdFx0cmV0dXJuIGF3YWl0IFByb21pc2UuYWxsKFtwcm9jZXNzRG9uZSwgc3Rkb3V0UHJvbWlzZSwgc3RkZXJyUHJvbWlzZSwgYWxsUHJvbWlzZV0pO1xuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdHJldHVybiBQcm9taXNlLmFsbChbXG5cdFx0XHR7ZXJyb3IsIHNpZ25hbDogZXJyb3Iuc2lnbmFsLCB0aW1lZE91dDogZXJyb3IudGltZWRPdXR9LFxuXHRcdFx0Z2V0QnVmZmVyZWREYXRhKHN0ZG91dCwgc3Rkb3V0UHJvbWlzZSksXG5cdFx0XHRnZXRCdWZmZXJlZERhdGEoc3RkZXJyLCBzdGRlcnJQcm9taXNlKSxcblx0XHRcdGdldEJ1ZmZlcmVkRGF0YShhbGwsIGFsbFByb21pc2UpXG5cdFx0XSk7XG5cdH1cbn07XG5cbmNvbnN0IHZhbGlkYXRlSW5wdXRTeW5jID0gKHtpbnB1dH0pID0+IHtcblx0aWYgKGlzU3RyZWFtKGlucHV0KSkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoZSBgaW5wdXRgIG9wdGlvbiBjYW5ub3QgYmUgYSBzdHJlYW0gaW4gc3luYyBtb2RlJyk7XG5cdH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRoYW5kbGVJbnB1dCxcblx0bWFrZUFsbFN0cmVhbSxcblx0Z2V0U3Bhd25lZFJlc3VsdCxcblx0dmFsaWRhdGVJbnB1dFN5bmNcbn07XG5cbiIsIid1c2Ugc3RyaWN0JztcblxuY29uc3QgbmF0aXZlUHJvbWlzZVByb3RvdHlwZSA9IChhc3luYyAoKSA9PiB7fSkoKS5jb25zdHJ1Y3Rvci5wcm90b3R5cGU7XG5jb25zdCBkZXNjcmlwdG9ycyA9IFsndGhlbicsICdjYXRjaCcsICdmaW5hbGx5J10ubWFwKHByb3BlcnR5ID0+IFtcblx0cHJvcGVydHksXG5cdFJlZmxlY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG5hdGl2ZVByb21pc2VQcm90b3R5cGUsIHByb3BlcnR5KVxuXSk7XG5cbi8vIFRoZSByZXR1cm4gdmFsdWUgaXMgYSBtaXhpbiBvZiBgY2hpbGRQcm9jZXNzYCBhbmQgYFByb21pc2VgXG5jb25zdCBtZXJnZVByb21pc2UgPSAoc3Bhd25lZCwgcHJvbWlzZSkgPT4ge1xuXHRmb3IgKGNvbnN0IFtwcm9wZXJ0eSwgZGVzY3JpcHRvcl0gb2YgZGVzY3JpcHRvcnMpIHtcblx0XHQvLyBTdGFydGluZyB0aGUgbWFpbiBgcHJvbWlzZWAgaXMgZGVmZXJyZWQgdG8gYXZvaWQgY29uc3VtaW5nIHN0cmVhbXNcblx0XHRjb25zdCB2YWx1ZSA9IHR5cGVvZiBwcm9taXNlID09PSAnZnVuY3Rpb24nID9cblx0XHRcdCguLi5hcmdzKSA9PiBSZWZsZWN0LmFwcGx5KGRlc2NyaXB0b3IudmFsdWUsIHByb21pc2UoKSwgYXJncykgOlxuXHRcdFx0ZGVzY3JpcHRvci52YWx1ZS5iaW5kKHByb21pc2UpO1xuXG5cdFx0UmVmbGVjdC5kZWZpbmVQcm9wZXJ0eShzcGF3bmVkLCBwcm9wZXJ0eSwgey4uLmRlc2NyaXB0b3IsIHZhbHVlfSk7XG5cdH1cblxuXHRyZXR1cm4gc3Bhd25lZDtcbn07XG5cbi8vIFVzZSBwcm9taXNlcyBpbnN0ZWFkIG9mIGBjaGlsZF9wcm9jZXNzYCBldmVudHNcbmNvbnN0IGdldFNwYXduZWRQcm9taXNlID0gc3Bhd25lZCA9PiB7XG5cdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0c3Bhd25lZC5vbignZXhpdCcsIChleGl0Q29kZSwgc2lnbmFsKSA9PiB7XG5cdFx0XHRyZXNvbHZlKHtleGl0Q29kZSwgc2lnbmFsfSk7XG5cdFx0fSk7XG5cblx0XHRzcGF3bmVkLm9uKCdlcnJvcicsIGVycm9yID0+IHtcblx0XHRcdHJlamVjdChlcnJvcik7XG5cdFx0fSk7XG5cblx0XHRpZiAoc3Bhd25lZC5zdGRpbikge1xuXHRcdFx0c3Bhd25lZC5zdGRpbi5vbignZXJyb3InLCBlcnJvciA9PiB7XG5cdFx0XHRcdHJlamVjdChlcnJvcik7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdG1lcmdlUHJvbWlzZSxcblx0Z2V0U3Bhd25lZFByb21pc2Vcbn07XG5cbiIsIid1c2Ugc3RyaWN0JztcbmNvbnN0IG5vcm1hbGl6ZUFyZ3MgPSAoZmlsZSwgYXJncyA9IFtdKSA9PiB7XG5cdGlmICghQXJyYXkuaXNBcnJheShhcmdzKSkge1xuXHRcdHJldHVybiBbZmlsZV07XG5cdH1cblxuXHRyZXR1cm4gW2ZpbGUsIC4uLmFyZ3NdO1xufTtcblxuY29uc3QgTk9fRVNDQVBFX1JFR0VYUCA9IC9eW1xcdy4tXSskLztcbmNvbnN0IERPVUJMRV9RVU9URVNfUkVHRVhQID0gL1wiL2c7XG5cbmNvbnN0IGVzY2FwZUFyZyA9IGFyZyA9PiB7XG5cdGlmICh0eXBlb2YgYXJnICE9PSAnc3RyaW5nJyB8fCBOT19FU0NBUEVfUkVHRVhQLnRlc3QoYXJnKSkge1xuXHRcdHJldHVybiBhcmc7XG5cdH1cblxuXHRyZXR1cm4gYFwiJHthcmcucmVwbGFjZShET1VCTEVfUVVPVEVTX1JFR0VYUCwgJ1xcXFxcIicpfVwiYDtcbn07XG5cbmNvbnN0IGpvaW5Db21tYW5kID0gKGZpbGUsIGFyZ3MpID0+IHtcblx0cmV0dXJuIG5vcm1hbGl6ZUFyZ3MoZmlsZSwgYXJncykuam9pbignICcpO1xufTtcblxuY29uc3QgZ2V0RXNjYXBlZENvbW1hbmQgPSAoZmlsZSwgYXJncykgPT4ge1xuXHRyZXR1cm4gbm9ybWFsaXplQXJncyhmaWxlLCBhcmdzKS5tYXAoYXJnID0+IGVzY2FwZUFyZyhhcmcpKS5qb2luKCcgJyk7XG59O1xuXG5jb25zdCBTUEFDRVNfUkVHRVhQID0gLyArL2c7XG5cbi8vIEhhbmRsZSBgZXhlY2EuY29tbWFuZCgpYFxuY29uc3QgcGFyc2VDb21tYW5kID0gY29tbWFuZCA9PiB7XG5cdGNvbnN0IHRva2VucyA9IFtdO1xuXHRmb3IgKGNvbnN0IHRva2VuIG9mIGNvbW1hbmQudHJpbSgpLnNwbGl0KFNQQUNFU19SRUdFWFApKSB7XG5cdFx0Ly8gQWxsb3cgc3BhY2VzIHRvIGJlIGVzY2FwZWQgYnkgYSBiYWNrc2xhc2ggaWYgbm90IG1lYW50IGFzIGEgZGVsaW1pdGVyXG5cdFx0Y29uc3QgcHJldmlvdXNUb2tlbiA9IHRva2Vuc1t0b2tlbnMubGVuZ3RoIC0gMV07XG5cdFx0aWYgKHByZXZpb3VzVG9rZW4gJiYgcHJldmlvdXNUb2tlbi5lbmRzV2l0aCgnXFxcXCcpKSB7XG5cdFx0XHQvLyBNZXJnZSBwcmV2aW91cyB0b2tlbiB3aXRoIGN1cnJlbnQgb25lXG5cdFx0XHR0b2tlbnNbdG9rZW5zLmxlbmd0aCAtIDFdID0gYCR7cHJldmlvdXNUb2tlbi5zbGljZSgwLCAtMSl9ICR7dG9rZW59YDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dG9rZW5zLnB1c2godG9rZW4pO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB0b2tlbnM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0am9pbkNvbW1hbmQsXG5cdGdldEVzY2FwZWRDb21tYW5kLFxuXHRwYXJzZUNvbW1hbmRcbn07XG4iLCIndXNlIHN0cmljdCc7XG5jb25zdCBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xuY29uc3QgY2hpbGRQcm9jZXNzID0gcmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpO1xuY29uc3QgY3Jvc3NTcGF3biA9IHJlcXVpcmUoJ2Nyb3NzLXNwYXduJyk7XG5jb25zdCBzdHJpcEZpbmFsTmV3bGluZSA9IHJlcXVpcmUoJ3N0cmlwLWZpbmFsLW5ld2xpbmUnKTtcbmNvbnN0IG5wbVJ1blBhdGggPSByZXF1aXJlKCducG0tcnVuLXBhdGgnKTtcbmNvbnN0IG9uZXRpbWUgPSByZXF1aXJlKCdvbmV0aW1lJyk7XG5jb25zdCBtYWtlRXJyb3IgPSByZXF1aXJlKCcuL2xpYi9lcnJvcicpO1xuY29uc3Qgbm9ybWFsaXplU3RkaW8gPSByZXF1aXJlKCcuL2xpYi9zdGRpbycpO1xuY29uc3Qge3NwYXduZWRLaWxsLCBzcGF3bmVkQ2FuY2VsLCBzZXR1cFRpbWVvdXQsIHZhbGlkYXRlVGltZW91dCwgc2V0RXhpdEhhbmRsZXJ9ID0gcmVxdWlyZSgnLi9saWIva2lsbCcpO1xuY29uc3Qge2hhbmRsZUlucHV0LCBnZXRTcGF3bmVkUmVzdWx0LCBtYWtlQWxsU3RyZWFtLCB2YWxpZGF0ZUlucHV0U3luY30gPSByZXF1aXJlKCcuL2xpYi9zdHJlYW0nKTtcbmNvbnN0IHttZXJnZVByb21pc2UsIGdldFNwYXduZWRQcm9taXNlfSA9IHJlcXVpcmUoJy4vbGliL3Byb21pc2UnKTtcbmNvbnN0IHtqb2luQ29tbWFuZCwgcGFyc2VDb21tYW5kLCBnZXRFc2NhcGVkQ29tbWFuZH0gPSByZXF1aXJlKCcuL2xpYi9jb21tYW5kJyk7XG5cbmNvbnN0IERFRkFVTFRfTUFYX0JVRkZFUiA9IDEwMDAgKiAxMDAwICogMTAwO1xuXG5jb25zdCBnZXRFbnYgPSAoe2VudjogZW52T3B0aW9uLCBleHRlbmRFbnYsIHByZWZlckxvY2FsLCBsb2NhbERpciwgZXhlY1BhdGh9KSA9PiB7XG5cdGNvbnN0IGVudiA9IGV4dGVuZEVudiA/IHsuLi5wcm9jZXNzLmVudiwgLi4uZW52T3B0aW9ufSA6IGVudk9wdGlvbjtcblxuXHRpZiAocHJlZmVyTG9jYWwpIHtcblx0XHRyZXR1cm4gbnBtUnVuUGF0aC5lbnYoe2VudiwgY3dkOiBsb2NhbERpciwgZXhlY1BhdGh9KTtcblx0fVxuXG5cdHJldHVybiBlbnY7XG59O1xuXG5jb25zdCBoYW5kbGVBcmd1bWVudHMgPSAoZmlsZSwgYXJncywgb3B0aW9ucyA9IHt9KSA9PiB7XG5cdGNvbnN0IHBhcnNlZCA9IGNyb3NzU3Bhd24uX3BhcnNlKGZpbGUsIGFyZ3MsIG9wdGlvbnMpO1xuXHRmaWxlID0gcGFyc2VkLmNvbW1hbmQ7XG5cdGFyZ3MgPSBwYXJzZWQuYXJncztcblx0b3B0aW9ucyA9IHBhcnNlZC5vcHRpb25zO1xuXG5cdG9wdGlvbnMgPSB7XG5cdFx0bWF4QnVmZmVyOiBERUZBVUxUX01BWF9CVUZGRVIsXG5cdFx0YnVmZmVyOiB0cnVlLFxuXHRcdHN0cmlwRmluYWxOZXdsaW5lOiB0cnVlLFxuXHRcdGV4dGVuZEVudjogdHJ1ZSxcblx0XHRwcmVmZXJMb2NhbDogZmFsc2UsXG5cdFx0bG9jYWxEaXI6IG9wdGlvbnMuY3dkIHx8IHByb2Nlc3MuY3dkKCksXG5cdFx0ZXhlY1BhdGg6IHByb2Nlc3MuZXhlY1BhdGgsXG5cdFx0ZW5jb2Rpbmc6ICd1dGY4Jyxcblx0XHRyZWplY3Q6IHRydWUsXG5cdFx0Y2xlYW51cDogdHJ1ZSxcblx0XHRhbGw6IGZhbHNlLFxuXHRcdHdpbmRvd3NIaWRlOiB0cnVlLFxuXHRcdC4uLm9wdGlvbnNcblx0fTtcblxuXHRvcHRpb25zLmVudiA9IGdldEVudihvcHRpb25zKTtcblxuXHRvcHRpb25zLnN0ZGlvID0gbm9ybWFsaXplU3RkaW8ob3B0aW9ucyk7XG5cblx0aWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicgJiYgcGF0aC5iYXNlbmFtZShmaWxlLCAnLmV4ZScpID09PSAnY21kJykge1xuXHRcdC8vICMxMTZcblx0XHRhcmdzLnVuc2hpZnQoJy9xJyk7XG5cdH1cblxuXHRyZXR1cm4ge2ZpbGUsIGFyZ3MsIG9wdGlvbnMsIHBhcnNlZH07XG59O1xuXG5jb25zdCBoYW5kbGVPdXRwdXQgPSAob3B0aW9ucywgdmFsdWUsIGVycm9yKSA9PiB7XG5cdGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnICYmICFCdWZmZXIuaXNCdWZmZXIodmFsdWUpKSB7XG5cdFx0Ly8gV2hlbiBgZXhlY2Euc3luYygpYCBlcnJvcnMsIHdlIG5vcm1hbGl6ZSBpdCB0byAnJyB0byBtaW1pYyBgZXhlY2EoKWBcblx0XHRyZXR1cm4gZXJyb3IgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6ICcnO1xuXHR9XG5cblx0aWYgKG9wdGlvbnMuc3RyaXBGaW5hbE5ld2xpbmUpIHtcblx0XHRyZXR1cm4gc3RyaXBGaW5hbE5ld2xpbmUodmFsdWUpO1xuXHR9XG5cblx0cmV0dXJuIHZhbHVlO1xufTtcblxuY29uc3QgZXhlY2EgPSAoZmlsZSwgYXJncywgb3B0aW9ucykgPT4ge1xuXHRjb25zdCBwYXJzZWQgPSBoYW5kbGVBcmd1bWVudHMoZmlsZSwgYXJncywgb3B0aW9ucyk7XG5cdGNvbnN0IGNvbW1hbmQgPSBqb2luQ29tbWFuZChmaWxlLCBhcmdzKTtcblx0Y29uc3QgZXNjYXBlZENvbW1hbmQgPSBnZXRFc2NhcGVkQ29tbWFuZChmaWxlLCBhcmdzKTtcblxuXHR2YWxpZGF0ZVRpbWVvdXQocGFyc2VkLm9wdGlvbnMpO1xuXG5cdGxldCBzcGF3bmVkO1xuXHR0cnkge1xuXHRcdHNwYXduZWQgPSBjaGlsZFByb2Nlc3Muc3Bhd24ocGFyc2VkLmZpbGUsIHBhcnNlZC5hcmdzLCBwYXJzZWQub3B0aW9ucyk7XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0Ly8gRW5zdXJlIHRoZSByZXR1cm5lZCBlcnJvciBpcyBhbHdheXMgYm90aCBhIHByb21pc2UgYW5kIGEgY2hpbGQgcHJvY2Vzc1xuXHRcdGNvbnN0IGR1bW15U3Bhd25lZCA9IG5ldyBjaGlsZFByb2Nlc3MuQ2hpbGRQcm9jZXNzKCk7XG5cdFx0Y29uc3QgZXJyb3JQcm9taXNlID0gUHJvbWlzZS5yZWplY3QobWFrZUVycm9yKHtcblx0XHRcdGVycm9yLFxuXHRcdFx0c3Rkb3V0OiAnJyxcblx0XHRcdHN0ZGVycjogJycsXG5cdFx0XHRhbGw6ICcnLFxuXHRcdFx0Y29tbWFuZCxcblx0XHRcdGVzY2FwZWRDb21tYW5kLFxuXHRcdFx0cGFyc2VkLFxuXHRcdFx0dGltZWRPdXQ6IGZhbHNlLFxuXHRcdFx0aXNDYW5jZWxlZDogZmFsc2UsXG5cdFx0XHRraWxsZWQ6IGZhbHNlXG5cdFx0fSkpO1xuXHRcdHJldHVybiBtZXJnZVByb21pc2UoZHVtbXlTcGF3bmVkLCBlcnJvclByb21pc2UpO1xuXHR9XG5cblx0Y29uc3Qgc3Bhd25lZFByb21pc2UgPSBnZXRTcGF3bmVkUHJvbWlzZShzcGF3bmVkKTtcblx0Y29uc3QgdGltZWRQcm9taXNlID0gc2V0dXBUaW1lb3V0KHNwYXduZWQsIHBhcnNlZC5vcHRpb25zLCBzcGF3bmVkUHJvbWlzZSk7XG5cdGNvbnN0IHByb2Nlc3NEb25lID0gc2V0RXhpdEhhbmRsZXIoc3Bhd25lZCwgcGFyc2VkLm9wdGlvbnMsIHRpbWVkUHJvbWlzZSk7XG5cblx0Y29uc3QgY29udGV4dCA9IHtpc0NhbmNlbGVkOiBmYWxzZX07XG5cblx0c3Bhd25lZC5raWxsID0gc3Bhd25lZEtpbGwuYmluZChudWxsLCBzcGF3bmVkLmtpbGwuYmluZChzcGF3bmVkKSk7XG5cdHNwYXduZWQuY2FuY2VsID0gc3Bhd25lZENhbmNlbC5iaW5kKG51bGwsIHNwYXduZWQsIGNvbnRleHQpO1xuXG5cdGNvbnN0IGhhbmRsZVByb21pc2UgPSBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgW3tlcnJvciwgZXhpdENvZGUsIHNpZ25hbCwgdGltZWRPdXR9LCBzdGRvdXRSZXN1bHQsIHN0ZGVyclJlc3VsdCwgYWxsUmVzdWx0XSA9IGF3YWl0IGdldFNwYXduZWRSZXN1bHQoc3Bhd25lZCwgcGFyc2VkLm9wdGlvbnMsIHByb2Nlc3NEb25lKTtcblx0XHRjb25zdCBzdGRvdXQgPSBoYW5kbGVPdXRwdXQocGFyc2VkLm9wdGlvbnMsIHN0ZG91dFJlc3VsdCk7XG5cdFx0Y29uc3Qgc3RkZXJyID0gaGFuZGxlT3V0cHV0KHBhcnNlZC5vcHRpb25zLCBzdGRlcnJSZXN1bHQpO1xuXHRcdGNvbnN0IGFsbCA9IGhhbmRsZU91dHB1dChwYXJzZWQub3B0aW9ucywgYWxsUmVzdWx0KTtcblxuXHRcdGlmIChlcnJvciB8fCBleGl0Q29kZSAhPT0gMCB8fCBzaWduYWwgIT09IG51bGwpIHtcblx0XHRcdGNvbnN0IHJldHVybmVkRXJyb3IgPSBtYWtlRXJyb3Ioe1xuXHRcdFx0XHRlcnJvcixcblx0XHRcdFx0ZXhpdENvZGUsXG5cdFx0XHRcdHNpZ25hbCxcblx0XHRcdFx0c3Rkb3V0LFxuXHRcdFx0XHRzdGRlcnIsXG5cdFx0XHRcdGFsbCxcblx0XHRcdFx0Y29tbWFuZCxcblx0XHRcdFx0ZXNjYXBlZENvbW1hbmQsXG5cdFx0XHRcdHBhcnNlZCxcblx0XHRcdFx0dGltZWRPdXQsXG5cdFx0XHRcdGlzQ2FuY2VsZWQ6IGNvbnRleHQuaXNDYW5jZWxlZCxcblx0XHRcdFx0a2lsbGVkOiBzcGF3bmVkLmtpbGxlZFxuXHRcdFx0fSk7XG5cblx0XHRcdGlmICghcGFyc2VkLm9wdGlvbnMucmVqZWN0KSB7XG5cdFx0XHRcdHJldHVybiByZXR1cm5lZEVycm9yO1xuXHRcdFx0fVxuXG5cdFx0XHR0aHJvdyByZXR1cm5lZEVycm9yO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRjb21tYW5kLFxuXHRcdFx0ZXNjYXBlZENvbW1hbmQsXG5cdFx0XHRleGl0Q29kZTogMCxcblx0XHRcdHN0ZG91dCxcblx0XHRcdHN0ZGVycixcblx0XHRcdGFsbCxcblx0XHRcdGZhaWxlZDogZmFsc2UsXG5cdFx0XHR0aW1lZE91dDogZmFsc2UsXG5cdFx0XHRpc0NhbmNlbGVkOiBmYWxzZSxcblx0XHRcdGtpbGxlZDogZmFsc2Vcblx0XHR9O1xuXHR9O1xuXG5cdGNvbnN0IGhhbmRsZVByb21pc2VPbmNlID0gb25ldGltZShoYW5kbGVQcm9taXNlKTtcblxuXHRoYW5kbGVJbnB1dChzcGF3bmVkLCBwYXJzZWQub3B0aW9ucy5pbnB1dCk7XG5cblx0c3Bhd25lZC5hbGwgPSBtYWtlQWxsU3RyZWFtKHNwYXduZWQsIHBhcnNlZC5vcHRpb25zKTtcblxuXHRyZXR1cm4gbWVyZ2VQcm9taXNlKHNwYXduZWQsIGhhbmRsZVByb21pc2VPbmNlKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZXhlY2E7XG5cbm1vZHVsZS5leHBvcnRzLnN5bmMgPSAoZmlsZSwgYXJncywgb3B0aW9ucykgPT4ge1xuXHRjb25zdCBwYXJzZWQgPSBoYW5kbGVBcmd1bWVudHMoZmlsZSwgYXJncywgb3B0aW9ucyk7XG5cdGNvbnN0IGNvbW1hbmQgPSBqb2luQ29tbWFuZChmaWxlLCBhcmdzKTtcblx0Y29uc3QgZXNjYXBlZENvbW1hbmQgPSBnZXRFc2NhcGVkQ29tbWFuZChmaWxlLCBhcmdzKTtcblxuXHR2YWxpZGF0ZUlucHV0U3luYyhwYXJzZWQub3B0aW9ucyk7XG5cblx0bGV0IHJlc3VsdDtcblx0dHJ5IHtcblx0XHRyZXN1bHQgPSBjaGlsZFByb2Nlc3Muc3Bhd25TeW5jKHBhcnNlZC5maWxlLCBwYXJzZWQuYXJncywgcGFyc2VkLm9wdGlvbnMpO1xuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdHRocm93IG1ha2VFcnJvcih7XG5cdFx0XHRlcnJvcixcblx0XHRcdHN0ZG91dDogJycsXG5cdFx0XHRzdGRlcnI6ICcnLFxuXHRcdFx0YWxsOiAnJyxcblx0XHRcdGNvbW1hbmQsXG5cdFx0XHRlc2NhcGVkQ29tbWFuZCxcblx0XHRcdHBhcnNlZCxcblx0XHRcdHRpbWVkT3V0OiBmYWxzZSxcblx0XHRcdGlzQ2FuY2VsZWQ6IGZhbHNlLFxuXHRcdFx0a2lsbGVkOiBmYWxzZVxuXHRcdH0pO1xuXHR9XG5cblx0Y29uc3Qgc3Rkb3V0ID0gaGFuZGxlT3V0cHV0KHBhcnNlZC5vcHRpb25zLCByZXN1bHQuc3Rkb3V0LCByZXN1bHQuZXJyb3IpO1xuXHRjb25zdCBzdGRlcnIgPSBoYW5kbGVPdXRwdXQocGFyc2VkLm9wdGlvbnMsIHJlc3VsdC5zdGRlcnIsIHJlc3VsdC5lcnJvcik7XG5cblx0aWYgKHJlc3VsdC5lcnJvciB8fCByZXN1bHQuc3RhdHVzICE9PSAwIHx8IHJlc3VsdC5zaWduYWwgIT09IG51bGwpIHtcblx0XHRjb25zdCBlcnJvciA9IG1ha2VFcnJvcih7XG5cdFx0XHRzdGRvdXQsXG5cdFx0XHRzdGRlcnIsXG5cdFx0XHRlcnJvcjogcmVzdWx0LmVycm9yLFxuXHRcdFx0c2lnbmFsOiByZXN1bHQuc2lnbmFsLFxuXHRcdFx0ZXhpdENvZGU6IHJlc3VsdC5zdGF0dXMsXG5cdFx0XHRjb21tYW5kLFxuXHRcdFx0ZXNjYXBlZENvbW1hbmQsXG5cdFx0XHRwYXJzZWQsXG5cdFx0XHR0aW1lZE91dDogcmVzdWx0LmVycm9yICYmIHJlc3VsdC5lcnJvci5jb2RlID09PSAnRVRJTUVET1VUJyxcblx0XHRcdGlzQ2FuY2VsZWQ6IGZhbHNlLFxuXHRcdFx0a2lsbGVkOiByZXN1bHQuc2lnbmFsICE9PSBudWxsXG5cdFx0fSk7XG5cblx0XHRpZiAoIXBhcnNlZC5vcHRpb25zLnJlamVjdCkge1xuXHRcdFx0cmV0dXJuIGVycm9yO1xuXHRcdH1cblxuXHRcdHRocm93IGVycm9yO1xuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRjb21tYW5kLFxuXHRcdGVzY2FwZWRDb21tYW5kLFxuXHRcdGV4aXRDb2RlOiAwLFxuXHRcdHN0ZG91dCxcblx0XHRzdGRlcnIsXG5cdFx0ZmFpbGVkOiBmYWxzZSxcblx0XHR0aW1lZE91dDogZmFsc2UsXG5cdFx0aXNDYW5jZWxlZDogZmFsc2UsXG5cdFx0a2lsbGVkOiBmYWxzZVxuXHR9O1xufTtcblxubW9kdWxlLmV4cG9ydHMuY29tbWFuZCA9IChjb21tYW5kLCBvcHRpb25zKSA9PiB7XG5cdGNvbnN0IFtmaWxlLCAuLi5hcmdzXSA9IHBhcnNlQ29tbWFuZChjb21tYW5kKTtcblx0cmV0dXJuIGV4ZWNhKGZpbGUsIGFyZ3MsIG9wdGlvbnMpO1xufTtcblxubW9kdWxlLmV4cG9ydHMuY29tbWFuZFN5bmMgPSAoY29tbWFuZCwgb3B0aW9ucykgPT4ge1xuXHRjb25zdCBbZmlsZSwgLi4uYXJnc10gPSBwYXJzZUNvbW1hbmQoY29tbWFuZCk7XG5cdHJldHVybiBleGVjYS5zeW5jKGZpbGUsIGFyZ3MsIG9wdGlvbnMpO1xufTtcblxubW9kdWxlLmV4cG9ydHMubm9kZSA9IChzY3JpcHRQYXRoLCBhcmdzLCBvcHRpb25zID0ge30pID0+IHtcblx0aWYgKGFyZ3MgJiYgIUFycmF5LmlzQXJyYXkoYXJncykgJiYgdHlwZW9mIGFyZ3MgPT09ICdvYmplY3QnKSB7XG5cdFx0b3B0aW9ucyA9IGFyZ3M7XG5cdFx0YXJncyA9IFtdO1xuXHR9XG5cblx0Y29uc3Qgc3RkaW8gPSBub3JtYWxpemVTdGRpby5ub2RlKG9wdGlvbnMpO1xuXHRjb25zdCBkZWZhdWx0RXhlY0FyZ3YgPSBwcm9jZXNzLmV4ZWNBcmd2LmZpbHRlcihhcmcgPT4gIWFyZy5zdGFydHNXaXRoKCctLWluc3BlY3QnKSk7XG5cblx0Y29uc3Qge1xuXHRcdG5vZGVQYXRoID0gcHJvY2Vzcy5leGVjUGF0aCxcblx0XHRub2RlT3B0aW9ucyA9IGRlZmF1bHRFeGVjQXJndlxuXHR9ID0gb3B0aW9ucztcblxuXHRyZXR1cm4gZXhlY2EoXG5cdFx0bm9kZVBhdGgsXG5cdFx0W1xuXHRcdFx0Li4ubm9kZU9wdGlvbnMsXG5cdFx0XHRzY3JpcHRQYXRoLFxuXHRcdFx0Li4uKEFycmF5LmlzQXJyYXkoYXJncykgPyBhcmdzIDogW10pXG5cdFx0XSxcblx0XHR7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0c3RkaW46IHVuZGVmaW5lZCxcblx0XHRcdHN0ZG91dDogdW5kZWZpbmVkLFxuXHRcdFx0c3RkZXJyOiB1bmRlZmluZWQsXG5cdFx0XHRzdGRpbyxcblx0XHRcdHNoZWxsOiBmYWxzZVxuXHRcdH1cblx0KTtcbn07XG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBhbnNpUmVnZXgoe29ubHlGaXJzdCA9IGZhbHNlfSA9IHt9KSB7XG5cdC8vIFZhbGlkIHN0cmluZyB0ZXJtaW5hdG9yIHNlcXVlbmNlcyBhcmUgQkVMLCBFU0NcXCwgYW5kIDB4OWNcblx0Y29uc3QgU1QgPSAnKD86XFxcXHUwMDA3fFxcXFx1MDAxQlxcXFx1MDA1Q3xcXFxcdTAwOUMpJztcblx0Y29uc3QgcGF0dGVybiA9IFtcblx0XHRgW1xcXFx1MDAxQlxcXFx1MDA5Ql1bW1xcXFxdKCkjOz9dKig/Oig/Oig/Oig/OjtbLWEtekEtWlxcXFxkXFxcXC8jJi46PT8lQH5fXSspKnxbYS16QS1aXFxcXGRdKyg/OjtbLWEtekEtWlxcXFxkXFxcXC8jJi46PT8lQH5fXSopKik/JHtTVH0pYCxcblx0XHQnKD86KD86XFxcXGR7MSw0fSg/OjtcXFxcZHswLDR9KSopP1tcXFxcZEEtUFItVFpjZi1ucS11eT0+PH5dKSknLFxuXHRdLmpvaW4oJ3wnKTtcblxuXHRyZXR1cm4gbmV3IFJlZ0V4cChwYXR0ZXJuLCBvbmx5Rmlyc3QgPyB1bmRlZmluZWQgOiAnZycpO1xufVxuIiwiaW1wb3J0IGFuc2lSZWdleCBmcm9tICdhbnNpLXJlZ2V4JztcblxuY29uc3QgcmVnZXggPSBhbnNpUmVnZXgoKTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gc3RyaXBBbnNpKHN0cmluZykge1xuXHRpZiAodHlwZW9mIHN0cmluZyAhPT0gJ3N0cmluZycpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGBFeHBlY3RlZCBhIFxcYHN0cmluZ1xcYCwgZ290IFxcYCR7dHlwZW9mIHN0cmluZ31cXGBgKTtcblx0fVxuXG5cdC8vIEV2ZW4gdGhvdWdoIHRoZSByZWdleCBpcyBnbG9iYWwsIHdlIGRvbid0IG5lZWQgdG8gcmVzZXQgdGhlIGAubGFzdEluZGV4YFxuXHQvLyBiZWNhdXNlIHVubGlrZSBgLmV4ZWMoKWAgYW5kIGAudGVzdCgpYCwgYC5yZXBsYWNlKClgIGRvZXMgaXQgYXV0b21hdGljYWxseVxuXHQvLyBhbmQgZG9pbmcgaXQgbWFudWFsbHkgaGFzIGEgcGVyZm9ybWFuY2UgcGVuYWx0eS5cblx0cmV0dXJuIHN0cmluZy5yZXBsYWNlKHJlZ2V4LCAnJyk7XG59XG4iLCJpbXBvcnQgcHJvY2VzcyBmcm9tICdub2RlOnByb2Nlc3MnO1xuaW1wb3J0IHt1c2VySW5mb30gZnJvbSAnbm9kZTpvcyc7XG5cbmV4cG9ydCBjb25zdCBkZXRlY3REZWZhdWx0U2hlbGwgPSAoKSA9PiB7XG5cdGNvbnN0IHtlbnZ9ID0gcHJvY2VzcztcblxuXHRpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuXHRcdHJldHVybiBlbnYuQ09NU1BFQyB8fCAnY21kLmV4ZSc7XG5cdH1cblxuXHR0cnkge1xuXHRcdGNvbnN0IHtzaGVsbH0gPSB1c2VySW5mbygpO1xuXHRcdGlmIChzaGVsbCkge1xuXHRcdFx0cmV0dXJuIHNoZWxsO1xuXHRcdH1cblx0fSBjYXRjaCB7fVxuXG5cdGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnZGFyd2luJykge1xuXHRcdHJldHVybiBlbnYuU0hFTEwgfHwgJy9iaW4venNoJztcblx0fVxuXG5cdHJldHVybiBlbnYuU0hFTEwgfHwgJy9iaW4vc2gnO1xufTtcblxuLy8gU3RvcmVzIGRlZmF1bHQgc2hlbGwgd2hlbiBpbXBvcnRlZC5cbmNvbnN0IGRlZmF1bHRTaGVsbCA9IGRldGVjdERlZmF1bHRTaGVsbCgpO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZhdWx0U2hlbGw7XG4iLCJpbXBvcnQgcHJvY2VzcyBmcm9tICdub2RlOnByb2Nlc3MnO1xuaW1wb3J0IGV4ZWNhIGZyb20gJ2V4ZWNhJztcbmltcG9ydCBzdHJpcEFuc2kgZnJvbSAnc3RyaXAtYW5zaSc7XG5pbXBvcnQgZGVmYXVsdFNoZWxsIGZyb20gJ2RlZmF1bHQtc2hlbGwnO1xuXG5jb25zdCBhcmdzID0gW1xuXHQnLWlsYycsXG5cdCdlY2hvIC1uIFwiX1NIRUxMX0VOVl9ERUxJTUlURVJfXCI7IGVudjsgZWNobyAtbiBcIl9TSEVMTF9FTlZfREVMSU1JVEVSX1wiOyBleGl0Jyxcbl07XG5cbmNvbnN0IGVudiA9IHtcblx0Ly8gRGlzYWJsZXMgT2ggTXkgWnNoIGF1dG8tdXBkYXRlIHRoaW5nIHRoYXQgY2FuIGJsb2NrIHRoZSBwcm9jZXNzLlxuXHRESVNBQkxFX0FVVE9fVVBEQVRFOiAndHJ1ZScsXG59O1xuXG5jb25zdCBwYXJzZUVudiA9IGVudiA9PiB7XG5cdGVudiA9IGVudi5zcGxpdCgnX1NIRUxMX0VOVl9ERUxJTUlURVJfJylbMV07XG5cdGNvbnN0IHJldHVyblZhbHVlID0ge307XG5cblx0Zm9yIChjb25zdCBsaW5lIG9mIHN0cmlwQW5zaShlbnYpLnNwbGl0KCdcXG4nKS5maWx0ZXIobGluZSA9PiBCb29sZWFuKGxpbmUpKSkge1xuXHRcdGNvbnN0IFtrZXksIC4uLnZhbHVlc10gPSBsaW5lLnNwbGl0KCc9Jyk7XG5cdFx0cmV0dXJuVmFsdWVba2V5XSA9IHZhbHVlcy5qb2luKCc9Jyk7XG5cdH1cblxuXHRyZXR1cm4gcmV0dXJuVmFsdWU7XG59O1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2hlbGxFbnYoc2hlbGwpIHtcblx0aWYgKHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicpIHtcblx0XHRyZXR1cm4gcHJvY2Vzcy5lbnY7XG5cdH1cblxuXHR0cnkge1xuXHRcdGNvbnN0IHtzdGRvdXR9ID0gYXdhaXQgZXhlY2Eoc2hlbGwgfHwgZGVmYXVsdFNoZWxsLCBhcmdzLCB7ZW52fSk7XG5cdFx0cmV0dXJuIHBhcnNlRW52KHN0ZG91dCk7XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0aWYgKHNoZWxsKSB7XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHByb2Nlc3MuZW52O1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hlbGxFbnZTeW5jKHNoZWxsKSB7XG5cdGlmIChwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG5cdFx0cmV0dXJuIHByb2Nlc3MuZW52O1xuXHR9XG5cblx0dHJ5IHtcblx0XHRjb25zdCB7c3Rkb3V0fSA9IGV4ZWNhLnN5bmMoc2hlbGwgfHwgZGVmYXVsdFNoZWxsLCBhcmdzLCB7ZW52fSk7XG5cdFx0cmV0dXJuIHBhcnNlRW52KHN0ZG91dCk7XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0aWYgKHNoZWxsKSB7XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHByb2Nlc3MuZW52O1xuXHRcdH1cblx0fVxufVxuIiwiaW1wb3J0IHtzaGVsbEVudiwgc2hlbGxFbnZTeW5jfSBmcm9tICdzaGVsbC1lbnYnO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2hlbGxQYXRoKCkge1xuXHRjb25zdCB7UEFUSH0gPSBhd2FpdCBzaGVsbEVudigpO1xuXHRyZXR1cm4gUEFUSDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNoZWxsUGF0aFN5bmMoKSB7XG5cdGNvbnN0IHtQQVRIfSA9IHNoZWxsRW52U3luYygpO1xuXHRyZXR1cm4gUEFUSDtcbn1cbiIsImltcG9ydCBwcm9jZXNzIGZyb20gJ25vZGU6cHJvY2Vzcyc7XG5pbXBvcnQge3NoZWxsUGF0aFN5bmN9IGZyb20gJ3NoZWxsLXBhdGgnO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBmaXhQYXRoKCkge1xuXHRpZiAocHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHByb2Nlc3MuZW52LlBBVEggPSBzaGVsbFBhdGhTeW5jKCkgfHwgW1xuXHRcdCcuL25vZGVfbW9kdWxlcy8uYmluJyxcblx0XHQnLy5ub2RlYnJldy9jdXJyZW50L2JpbicsXG5cdFx0Jy91c3IvbG9jYWwvYmluJyxcblx0XHRwcm9jZXNzLmVudi5QQVRILFxuXHRdLmpvaW4oJzonKTtcbn1cbiIsImltcG9ydCB7IGV4dG5hbWUgfSBmcm9tIFwicGF0aC1icm93c2VyaWZ5XCI7XG5pbXBvcnQgeyBSZWFkYWJsZSB9IGZyb20gXCJzdHJlYW1cIjtcbmltcG9ydCB7IGNsaXBib2FyZCB9IGZyb20gXCJlbGVjdHJvblwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIElTdHJpbmdLZXlNYXA8VD4ge1xuICBba2V5OiBzdHJpbmddOiBUO1xufVxuXG5jb25zdCBJTUFHRV9FWFRfTElTVCA9IFtcbiAgXCIucG5nXCIsXG4gIFwiLmpwZ1wiLFxuICBcIi5qcGVnXCIsXG4gIFwiLmJtcFwiLFxuICBcIi5naWZcIixcbiAgXCIuc3ZnXCIsXG4gIFwiLnRpZmZcIixcbiAgXCIud2VicFwiLFxuICBcIi5hdmlmXCIsXG5dO1xuXG5jb25zdCBWSURFT19FWFRfTElTVCA9IFtcIi5tcDRcIiwgXCIubW92XCIsIFwiLndlYm1cIiwgXCIubWt2XCIsIFwiLmF2aVwiXTtcbmNvbnN0IEFVRElPX0VYVF9MSVNUID0gW1wiLm1wM1wiLCBcIi53YXZcIiwgXCIuZmxhY1wiLCBcIi5hYWNcIiwgXCIub2dnXCJdO1xuXG5leHBvcnQgY29uc3QgTUVESUFfRVhUX0xJU1QgPSBbXG4gIC4uLlZJREVPX0VYVF9MSVNULFxuICAuLi5BVURJT19FWFRfTElTVCxcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0FuSW1hZ2UoZXh0OiBzdHJpbmcpIHtcbiAgcmV0dXJuIElNQUdFX0VYVF9MSVNULmluY2x1ZGVzKGV4dC50b0xvd2VyQ2FzZSgpKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBpc0Fzc2V0VHlwZUFuSW1hZ2UocGF0aDogc3RyaW5nKTogQm9vbGVhbiB7XG4gIHJldHVybiBpc0FuSW1hZ2UoZXh0bmFtZShwYXRoKSk7XG59XG5leHBvcnQgZnVuY3Rpb24gaXNBc3NldFR5cGVBbkFzc2V0KHBhdGg6IHN0cmluZyk6IEJvb2xlYW4ge1xuICBjb25zdCBleHQgPSBleHRuYW1lKHBhdGgpLnRvTG93ZXJDYXNlKCk7XG4gIHJldHVybiBpc0FuSW1hZ2UoZXh0KSB8fCBNRURJQV9FWFRfTElTVC5pbmNsdWRlcyhleHQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RW1iZWRNYXJrZG93bihcbiAgZmlsZU5hbWU6IHN0cmluZyxcbiAgdXJsOiBzdHJpbmcsXG4gIGltYWdlTmFtZSA9IGZpbGVOYW1lXG4pIHtcbiAgY29uc3QgZXh0ID0gZXh0bmFtZShmaWxlTmFtZSkudG9Mb3dlckNhc2UoKTtcblxuICBpZiAoVklERU9fRVhUX0xJU1QuaW5jbHVkZXMoZXh0KSkge1xuICAgIHJldHVybiBgPHZpZGVvIHNyYz1cIiR7dXJsfVwiIGNvbnRyb2xzIHdpZHRoPVwiMzAwXCI+PC92aWRlbz5gO1xuICB9XG5cbiAgaWYgKEFVRElPX0VYVF9MSVNULmluY2x1ZGVzKGV4dCkpIHtcbiAgICByZXR1cm4gYDxhdWRpbyBzcmM9XCIke3VybH1cIiBjb250cm9scz48L2F1ZGlvPmA7XG4gIH1cblxuICByZXR1cm4gYCFbJHtpbWFnZU5hbWV9XSgke3VybH0pYDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE9TKCkge1xuICBjb25zdCB7IGFwcFZlcnNpb24gfSA9IG5hdmlnYXRvcjtcbiAgaWYgKGFwcFZlcnNpb24uaW5kZXhPZihcIldpblwiKSAhPT0gLTEpIHtcbiAgICByZXR1cm4gXCJXaW5kb3dzXCI7XG4gIH0gZWxzZSBpZiAoYXBwVmVyc2lvbi5pbmRleE9mKFwiTWFjXCIpICE9PSAtMSkge1xuICAgIHJldHVybiBcIk1hY09TXCI7XG4gIH0gZWxzZSBpZiAoYXBwVmVyc2lvbi5pbmRleE9mKFwiWDExXCIpICE9PSAtMSkge1xuICAgIHJldHVybiBcIkxpbnV4XCI7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIFwiVW5rbm93biBPU1wiO1xuICB9XG59XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc3RyZWFtVG9TdHJpbmcoc3RyZWFtOiBSZWFkYWJsZSkge1xuICBjb25zdCBjaHVua3MgPSBbXTtcblxuICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHN0cmVhbSkge1xuICAgIGNodW5rcy5wdXNoKEJ1ZmZlci5mcm9tKGNodW5rKSk7XG4gIH1cblxuICAvLyBAdHMtaWdub3JlXG4gIHJldHVybiBCdWZmZXIuY29uY2F0KGNodW5rcykudG9TdHJpbmcoXCJ1dGYtOFwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVybEFzc2V0KHVybDogc3RyaW5nKSB7XG4gIHJldHVybiAodXJsID0gdXJsLnN1YnN0cigxICsgdXJsLmxhc3RJbmRleE9mKFwiL1wiKSkuc3BsaXQoXCI/XCIpWzBdKS5zcGxpdChcbiAgICBcIiNcIlxuICApWzBdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNDb3B5SW1hZ2VGaWxlKCkge1xuICBsZXQgZmlsZVBhdGggPSBcIlwiO1xuICBjb25zdCBvcyA9IGdldE9TKCk7XG5cbiAgaWYgKG9zID09PSBcIldpbmRvd3NcIikge1xuICAgIHZhciByYXdGaWxlUGF0aCA9IGNsaXBib2FyZC5yZWFkKFwiRmlsZU5hbWVXXCIpO1xuICAgIGZpbGVQYXRoID0gcmF3RmlsZVBhdGgucmVwbGFjZShuZXcgUmVnRXhwKFN0cmluZy5mcm9tQ2hhckNvZGUoMCksIFwiZ1wiKSwgXCJcIik7XG4gIH0gZWxzZSBpZiAob3MgPT09IFwiTWFjT1NcIikge1xuICAgIGZpbGVQYXRoID0gY2xpcGJvYXJkLnJlYWQoXCJwdWJsaWMuZmlsZS11cmxcIikucmVwbGFjZShcImZpbGU6Ly9cIiwgXCJcIik7XG4gIH0gZWxzZSB7XG4gICAgZmlsZVBhdGggPSBcIlwiO1xuICB9XG4gIHJldHVybiBpc0Fzc2V0VHlwZUFuSW1hZ2UoZmlsZVBhdGgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TGFzdEltYWdlKGxpc3Q6IHN0cmluZ1tdKSB7XG4gIGNvbnN0IHJldmVyc2VkTGlzdCA9IGxpc3QucmV2ZXJzZSgpO1xuICBsZXQgbGFzdEltYWdlO1xuICByZXZlcnNlZExpc3QuZm9yRWFjaChpdGVtID0+IHtcbiAgICBpZiAoaXRlbSAmJiBpdGVtLnN0YXJ0c1dpdGgoXCJodHRwXCIpKSB7XG4gICAgICBsYXN0SW1hZ2UgPSBpdGVtO1xuICAgICAgcmV0dXJuIGl0ZW07XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGxhc3RJbWFnZTtcbn1cblxuaW50ZXJmYWNlIEFueU9iaiB7XG4gIFtrZXk6IHN0cmluZ106IGFueTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFycmF5VG9PYmplY3Q8VCBleHRlbmRzIEFueU9iaj4oXG4gIGFycjogVFtdLFxuICBrZXk6IHN0cmluZ1xuKTogeyBba2V5OiBzdHJpbmddOiBUIH0ge1xuICBjb25zdCBvYmo6IHsgW2tleTogc3RyaW5nXTogVCB9ID0ge307XG4gIGFyci5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuICAgIG9ialtlbGVtZW50W2tleV1dID0gZWxlbWVudDtcbiAgfSk7XG4gIHJldHVybiBvYmo7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWZmZXJUb0FycmF5QnVmZmVyKGJ1ZmZlcjogQnVmZmVyKSB7XG4gIGNvbnN0IGFycmF5QnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKGJ1ZmZlci5sZW5ndGgpO1xuICBjb25zdCB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXlCdWZmZXIpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGJ1ZmZlci5sZW5ndGg7IGkrKykge1xuICAgIHZpZXdbaV0gPSBidWZmZXJbaV07XG4gIH1cbiAgcmV0dXJuIGFycmF5QnVmZmVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdXVpZCgpIHtcbiAgcmV0dXJuIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpO1xufVxuIiwiaW1wb3J0ICogYXMgaWVlZTc1NCBmcm9tICdpZWVlNzU0JztcbmltcG9ydCB7IEJ1ZmZlciB9IGZyb20gJ25vZGU6YnVmZmVyJztcbi8vIFByaW1pdGl2ZSB0eXBlc1xuZnVuY3Rpb24gZHYoYXJyYXkpIHtcbiAgICByZXR1cm4gbmV3IERhdGFWaWV3KGFycmF5LmJ1ZmZlciwgYXJyYXkuYnl0ZU9mZnNldCk7XG59XG4vKipcbiAqIDgtYml0IHVuc2lnbmVkIGludGVnZXJcbiAqL1xuZXhwb3J0IGNvbnN0IFVJTlQ4ID0ge1xuICAgIGxlbjogMSxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldFVpbnQ4KG9mZnNldCk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldFVpbnQ4KG9mZnNldCwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgMTtcbiAgICB9XG59O1xuLyoqXG4gKiAxNi1iaXQgdW5zaWduZWQgaW50ZWdlciwgTGl0dGxlIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBVSU5UMTZfTEUgPSB7XG4gICAgbGVuOiAyLFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0VWludDE2KG9mZnNldCwgdHJ1ZSk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldFVpbnQxNihvZmZzZXQsIHZhbHVlLCB0cnVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDI7XG4gICAgfVxufTtcbi8qKlxuICogMTYtYml0IHVuc2lnbmVkIGludGVnZXIsIEJpZyBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgVUlOVDE2X0JFID0ge1xuICAgIGxlbjogMixcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldFVpbnQxNihvZmZzZXQpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRVaW50MTYob2Zmc2V0LCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyAyO1xuICAgIH1cbn07XG4vKipcbiAqIDI0LWJpdCB1bnNpZ25lZCBpbnRlZ2VyLCBMaXR0bGUgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IFVJTlQyNF9MRSA9IHtcbiAgICBsZW46IDMsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgY29uc3QgZGF0YVZpZXcgPSBkdihhcnJheSk7XG4gICAgICAgIHJldHVybiBkYXRhVmlldy5nZXRVaW50OChvZmZzZXQpICsgKGRhdGFWaWV3LmdldFVpbnQxNihvZmZzZXQgKyAxLCB0cnVlKSA8PCA4KTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBjb25zdCBkYXRhVmlldyA9IGR2KGFycmF5KTtcbiAgICAgICAgZGF0YVZpZXcuc2V0VWludDgob2Zmc2V0LCB2YWx1ZSAmIDB4ZmYpO1xuICAgICAgICBkYXRhVmlldy5zZXRVaW50MTYob2Zmc2V0ICsgMSwgdmFsdWUgPj4gOCwgdHJ1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyAzO1xuICAgIH1cbn07XG4vKipcbiAqIDI0LWJpdCB1bnNpZ25lZCBpbnRlZ2VyLCBCaWcgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IFVJTlQyNF9CRSA9IHtcbiAgICBsZW46IDMsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgY29uc3QgZGF0YVZpZXcgPSBkdihhcnJheSk7XG4gICAgICAgIHJldHVybiAoZGF0YVZpZXcuZ2V0VWludDE2KG9mZnNldCkgPDwgOCkgKyBkYXRhVmlldy5nZXRVaW50OChvZmZzZXQgKyAyKTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBjb25zdCBkYXRhVmlldyA9IGR2KGFycmF5KTtcbiAgICAgICAgZGF0YVZpZXcuc2V0VWludDE2KG9mZnNldCwgdmFsdWUgPj4gOCk7XG4gICAgICAgIGRhdGFWaWV3LnNldFVpbnQ4KG9mZnNldCArIDIsIHZhbHVlICYgMHhmZik7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyAzO1xuICAgIH1cbn07XG4vKipcbiAqIDMyLWJpdCB1bnNpZ25lZCBpbnRlZ2VyLCBMaXR0bGUgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IFVJTlQzMl9MRSA9IHtcbiAgICBsZW46IDQsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRVaW50MzIob2Zmc2V0LCB0cnVlKTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0VWludDMyKG9mZnNldCwgdmFsdWUsIHRydWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgNDtcbiAgICB9XG59O1xuLyoqXG4gKiAzMi1iaXQgdW5zaWduZWQgaW50ZWdlciwgQmlnIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBVSU5UMzJfQkUgPSB7XG4gICAgbGVuOiA0LFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0VWludDMyKG9mZnNldCk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldFVpbnQzMihvZmZzZXQsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDQ7XG4gICAgfVxufTtcbi8qKlxuICogOC1iaXQgc2lnbmVkIGludGVnZXJcbiAqL1xuZXhwb3J0IGNvbnN0IElOVDggPSB7XG4gICAgbGVuOiAxLFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0SW50OChvZmZzZXQpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRJbnQ4KG9mZnNldCwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgMTtcbiAgICB9XG59O1xuLyoqXG4gKiAxNi1iaXQgc2lnbmVkIGludGVnZXIsIEJpZyBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgSU5UMTZfQkUgPSB7XG4gICAgbGVuOiAyLFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0SW50MTYob2Zmc2V0KTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0SW50MTYob2Zmc2V0LCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyAyO1xuICAgIH1cbn07XG4vKipcbiAqIDE2LWJpdCBzaWduZWQgaW50ZWdlciwgTGl0dGxlIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBJTlQxNl9MRSA9IHtcbiAgICBsZW46IDIsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRJbnQxNihvZmZzZXQsIHRydWUpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRJbnQxNihvZmZzZXQsIHZhbHVlLCB0cnVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDI7XG4gICAgfVxufTtcbi8qKlxuICogMjQtYml0IHNpZ25lZCBpbnRlZ2VyLCBMaXR0bGUgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IElOVDI0X0xFID0ge1xuICAgIGxlbjogMyxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICBjb25zdCB1bnNpZ25lZCA9IFVJTlQyNF9MRS5nZXQoYXJyYXksIG9mZnNldCk7XG4gICAgICAgIHJldHVybiB1bnNpZ25lZCA+IDB4N2ZmZmZmID8gdW5zaWduZWQgLSAweDEwMDAwMDAgOiB1bnNpZ25lZDtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBjb25zdCBkYXRhVmlldyA9IGR2KGFycmF5KTtcbiAgICAgICAgZGF0YVZpZXcuc2V0VWludDgob2Zmc2V0LCB2YWx1ZSAmIDB4ZmYpO1xuICAgICAgICBkYXRhVmlldy5zZXRVaW50MTYob2Zmc2V0ICsgMSwgdmFsdWUgPj4gOCwgdHJ1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyAzO1xuICAgIH1cbn07XG4vKipcbiAqIDI0LWJpdCBzaWduZWQgaW50ZWdlciwgQmlnIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBJTlQyNF9CRSA9IHtcbiAgICBsZW46IDMsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgY29uc3QgdW5zaWduZWQgPSBVSU5UMjRfQkUuZ2V0KGFycmF5LCBvZmZzZXQpO1xuICAgICAgICByZXR1cm4gdW5zaWduZWQgPiAweDdmZmZmZiA/IHVuc2lnbmVkIC0gMHgxMDAwMDAwIDogdW5zaWduZWQ7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgY29uc3QgZGF0YVZpZXcgPSBkdihhcnJheSk7XG4gICAgICAgIGRhdGFWaWV3LnNldFVpbnQxNihvZmZzZXQsIHZhbHVlID4+IDgpO1xuICAgICAgICBkYXRhVmlldy5zZXRVaW50OChvZmZzZXQgKyAyLCB2YWx1ZSAmIDB4ZmYpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgMztcbiAgICB9XG59O1xuLyoqXG4gKiAzMi1iaXQgc2lnbmVkIGludGVnZXIsIEJpZyBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgSU5UMzJfQkUgPSB7XG4gICAgbGVuOiA0LFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0SW50MzIob2Zmc2V0KTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0SW50MzIob2Zmc2V0LCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyA0O1xuICAgIH1cbn07XG4vKipcbiAqIDMyLWJpdCBzaWduZWQgaW50ZWdlciwgQmlnIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBJTlQzMl9MRSA9IHtcbiAgICBsZW46IDQsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRJbnQzMihvZmZzZXQsIHRydWUpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRJbnQzMihvZmZzZXQsIHZhbHVlLCB0cnVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDQ7XG4gICAgfVxufTtcbi8qKlxuICogNjQtYml0IHVuc2lnbmVkIGludGVnZXIsIExpdHRsZSBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgVUlOVDY0X0xFID0ge1xuICAgIGxlbjogOCxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldEJpZ1VpbnQ2NChvZmZzZXQsIHRydWUpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRCaWdVaW50NjQob2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyA4O1xuICAgIH1cbn07XG4vKipcbiAqIDY0LWJpdCBzaWduZWQgaW50ZWdlciwgTGl0dGxlIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBJTlQ2NF9MRSA9IHtcbiAgICBsZW46IDgsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRCaWdJbnQ2NChvZmZzZXQsIHRydWUpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRCaWdJbnQ2NChvZmZzZXQsIHZhbHVlLCB0cnVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDg7XG4gICAgfVxufTtcbi8qKlxuICogNjQtYml0IHVuc2lnbmVkIGludGVnZXIsIEJpZyBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgVUlOVDY0X0JFID0ge1xuICAgIGxlbjogOCxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldEJpZ1VpbnQ2NChvZmZzZXQpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRCaWdVaW50NjQob2Zmc2V0LCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyA4O1xuICAgIH1cbn07XG4vKipcbiAqIDY0LWJpdCBzaWduZWQgaW50ZWdlciwgQmlnIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBJTlQ2NF9CRSA9IHtcbiAgICBsZW46IDgsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRCaWdJbnQ2NChvZmZzZXQpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRCaWdJbnQ2NChvZmZzZXQsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDg7XG4gICAgfVxufTtcbi8qKlxuICogSUVFRSA3NTQgMTYtYml0IChoYWxmIHByZWNpc2lvbikgZmxvYXQsIGJpZyBlbmRpYW5cbiAqL1xuZXhwb3J0IGNvbnN0IEZsb2F0MTZfQkUgPSB7XG4gICAgbGVuOiAyLFxuICAgIGdldChkYXRhVmlldywgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBpZWVlNzU0LnJlYWQoZGF0YVZpZXcsIG9mZnNldCwgZmFsc2UsIDEwLCB0aGlzLmxlbik7XG4gICAgfSxcbiAgICBwdXQoZGF0YVZpZXcsIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgaWVlZTc1NC53cml0ZShkYXRhVmlldywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIDEwLCB0aGlzLmxlbik7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyB0aGlzLmxlbjtcbiAgICB9XG59O1xuLyoqXG4gKiBJRUVFIDc1NCAxNi1iaXQgKGhhbGYgcHJlY2lzaW9uKSBmbG9hdCwgbGl0dGxlIGVuZGlhblxuICovXG5leHBvcnQgY29uc3QgRmxvYXQxNl9MRSA9IHtcbiAgICBsZW46IDIsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGllZWU3NTQucmVhZChhcnJheSwgb2Zmc2V0LCB0cnVlLCAxMCwgdGhpcy5sZW4pO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGllZWU3NTQud3JpdGUoYXJyYXksIHZhbHVlLCBvZmZzZXQsIHRydWUsIDEwLCB0aGlzLmxlbik7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyB0aGlzLmxlbjtcbiAgICB9XG59O1xuLyoqXG4gKiBJRUVFIDc1NCAzMi1iaXQgKHNpbmdsZSBwcmVjaXNpb24pIGZsb2F0LCBiaWcgZW5kaWFuXG4gKi9cbmV4cG9ydCBjb25zdCBGbG9hdDMyX0JFID0ge1xuICAgIGxlbjogNCxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldEZsb2F0MzIob2Zmc2V0KTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0RmxvYXQzMihvZmZzZXQsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDQ7XG4gICAgfVxufTtcbi8qKlxuICogSUVFRSA3NTQgMzItYml0IChzaW5nbGUgcHJlY2lzaW9uKSBmbG9hdCwgbGl0dGxlIGVuZGlhblxuICovXG5leHBvcnQgY29uc3QgRmxvYXQzMl9MRSA9IHtcbiAgICBsZW46IDQsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRGbG9hdDMyKG9mZnNldCwgdHJ1ZSk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldEZsb2F0MzIob2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyA0O1xuICAgIH1cbn07XG4vKipcbiAqIElFRUUgNzU0IDY0LWJpdCAoZG91YmxlIHByZWNpc2lvbikgZmxvYXQsIGJpZyBlbmRpYW5cbiAqL1xuZXhwb3J0IGNvbnN0IEZsb2F0NjRfQkUgPSB7XG4gICAgbGVuOiA4LFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0RmxvYXQ2NChvZmZzZXQpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRGbG9hdDY0KG9mZnNldCwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgODtcbiAgICB9XG59O1xuLyoqXG4gKiBJRUVFIDc1NCA2NC1iaXQgKGRvdWJsZSBwcmVjaXNpb24pIGZsb2F0LCBsaXR0bGUgZW5kaWFuXG4gKi9cbmV4cG9ydCBjb25zdCBGbG9hdDY0X0xFID0ge1xuICAgIGxlbjogOCxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldEZsb2F0NjQob2Zmc2V0LCB0cnVlKTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0RmxvYXQ2NChvZmZzZXQsIHZhbHVlLCB0cnVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDg7XG4gICAgfVxufTtcbi8qKlxuICogSUVFRSA3NTQgODAtYml0IChleHRlbmRlZCBwcmVjaXNpb24pIGZsb2F0LCBiaWcgZW5kaWFuXG4gKi9cbmV4cG9ydCBjb25zdCBGbG9hdDgwX0JFID0ge1xuICAgIGxlbjogMTAsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGllZWU3NTQucmVhZChhcnJheSwgb2Zmc2V0LCBmYWxzZSwgNjMsIHRoaXMubGVuKTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBpZWVlNzU0LndyaXRlKGFycmF5LCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgNjMsIHRoaXMubGVuKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIHRoaXMubGVuO1xuICAgIH1cbn07XG4vKipcbiAqIElFRUUgNzU0IDgwLWJpdCAoZXh0ZW5kZWQgcHJlY2lzaW9uKSBmbG9hdCwgbGl0dGxlIGVuZGlhblxuICovXG5leHBvcnQgY29uc3QgRmxvYXQ4MF9MRSA9IHtcbiAgICBsZW46IDEwLFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBpZWVlNzU0LnJlYWQoYXJyYXksIG9mZnNldCwgdHJ1ZSwgNjMsIHRoaXMubGVuKTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBpZWVlNzU0LndyaXRlKGFycmF5LCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCA2MywgdGhpcy5sZW4pO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgdGhpcy5sZW47XG4gICAgfVxufTtcbi8qKlxuICogSWdub3JlIGEgZ2l2ZW4gbnVtYmVyIG9mIGJ5dGVzXG4gKi9cbmV4cG9ydCBjbGFzcyBJZ25vcmVUeXBlIHtcbiAgICAvKipcbiAgICAgKiBAcGFyYW0gbGVuIG51bWJlciBvZiBieXRlcyB0byBpZ25vcmVcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihsZW4pIHtcbiAgICAgICAgdGhpcy5sZW4gPSBsZW47XG4gICAgfVxuICAgIC8vIFRvRG86IGRvbid0IHJlYWQsIGJ1dCBza2lwIGRhdGFcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWVtcHR5LWZ1bmN0aW9uXG4gICAgZ2V0KGFycmF5LCBvZmYpIHtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgVWludDhBcnJheVR5cGUge1xuICAgIGNvbnN0cnVjdG9yKGxlbikge1xuICAgICAgICB0aGlzLmxlbiA9IGxlbjtcbiAgICB9XG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGFycmF5LnN1YmFycmF5KG9mZnNldCwgb2Zmc2V0ICsgdGhpcy5sZW4pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBCdWZmZXJUeXBlIHtcbiAgICBjb25zdHJ1Y3RvcihsZW4pIHtcbiAgICAgICAgdGhpcy5sZW4gPSBsZW47XG4gICAgfVxuICAgIGdldCh1aW50OEFycmF5LCBvZmYpIHtcbiAgICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKHVpbnQ4QXJyYXkuc3ViYXJyYXkob2ZmLCBvZmYgKyB0aGlzLmxlbikpO1xuICAgIH1cbn1cbi8qKlxuICogQ29uc3VtZSBhIGZpeGVkIG51bWJlciBvZiBieXRlcyBmcm9tIHRoZSBzdHJlYW0gYW5kIHJldHVybiBhIHN0cmluZyB3aXRoIGEgc3BlY2lmaWVkIGVuY29kaW5nLlxuICovXG5leHBvcnQgY2xhc3MgU3RyaW5nVHlwZSB7XG4gICAgY29uc3RydWN0b3IobGVuLCBlbmNvZGluZykge1xuICAgICAgICB0aGlzLmxlbiA9IGxlbjtcbiAgICAgICAgdGhpcy5lbmNvZGluZyA9IGVuY29kaW5nO1xuICAgIH1cbiAgICBnZXQodWludDhBcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBCdWZmZXIuZnJvbSh1aW50OEFycmF5KS50b1N0cmluZyh0aGlzLmVuY29kaW5nLCBvZmZzZXQsIG9mZnNldCArIHRoaXMubGVuKTtcbiAgICB9XG59XG4vKipcbiAqIEFOU0kgTGF0aW4gMSBTdHJpbmdcbiAqIFVzaW5nIHdpbmRvd3MtMTI1MiAvIElTTyA4ODU5LTEgZGVjb2RpbmdcbiAqL1xuZXhwb3J0IGNsYXNzIEFuc2lTdHJpbmdUeXBlIHtcbiAgICBjb25zdHJ1Y3RvcihsZW4pIHtcbiAgICAgICAgdGhpcy5sZW4gPSBsZW47XG4gICAgfVxuICAgIHN0YXRpYyBkZWNvZGUoYnVmZmVyLCBvZmZzZXQsIHVudGlsKSB7XG4gICAgICAgIGxldCBzdHIgPSAnJztcbiAgICAgICAgZm9yIChsZXQgaSA9IG9mZnNldDsgaSA8IHVudGlsOyArK2kpIHtcbiAgICAgICAgICAgIHN0ciArPSBBbnNpU3RyaW5nVHlwZS5jb2RlUG9pbnRUb1N0cmluZyhBbnNpU3RyaW5nVHlwZS5zaW5nbGVCeXRlRGVjb2RlcihidWZmZXJbaV0pKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICBzdGF0aWMgaW5SYW5nZShhLCBtaW4sIG1heCkge1xuICAgICAgICByZXR1cm4gbWluIDw9IGEgJiYgYSA8PSBtYXg7XG4gICAgfVxuICAgIHN0YXRpYyBjb2RlUG9pbnRUb1N0cmluZyhjcCkge1xuICAgICAgICBpZiAoY3AgPD0gMHhGRkZGKSB7XG4gICAgICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShjcCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjcCAtPSAweDEwMDAwO1xuICAgICAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoKGNwID4+IDEwKSArIDB4RDgwMCwgKGNwICYgMHgzRkYpICsgMHhEQzAwKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBzdGF0aWMgc2luZ2xlQnl0ZURlY29kZXIoYml0ZSkge1xuICAgICAgICBpZiAoQW5zaVN0cmluZ1R5cGUuaW5SYW5nZShiaXRlLCAweDAwLCAweDdGKSkge1xuICAgICAgICAgICAgcmV0dXJuIGJpdGU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY29kZVBvaW50ID0gQW5zaVN0cmluZ1R5cGUud2luZG93czEyNTJbYml0ZSAtIDB4ODBdO1xuICAgICAgICBpZiAoY29kZVBvaW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignaW52YWxpZGluZyBlbmNvZGluZycpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb2RlUG9pbnQ7XG4gICAgfVxuICAgIGdldChidWZmZXIsIG9mZnNldCA9IDApIHtcbiAgICAgICAgcmV0dXJuIEFuc2lTdHJpbmdUeXBlLmRlY29kZShidWZmZXIsIG9mZnNldCwgb2Zmc2V0ICsgdGhpcy5sZW4pO1xuICAgIH1cbn1cbkFuc2lTdHJpbmdUeXBlLndpbmRvd3MxMjUyID0gWzgzNjQsIDEyOSwgODIxOCwgNDAyLCA4MjIyLCA4MjMwLCA4MjI0LCA4MjI1LCA3MTAsIDgyNDAsIDM1MixcbiAgICA4MjQ5LCAzMzgsIDE0MSwgMzgxLCAxNDMsIDE0NCwgODIxNiwgODIxNywgODIyMCwgODIyMSwgODIyNiwgODIxMSwgODIxMiwgNzMyLFxuICAgIDg0ODIsIDM1MywgODI1MCwgMzM5LCAxNTcsIDM4MiwgMzc2LCAxNjAsIDE2MSwgMTYyLCAxNjMsIDE2NCwgMTY1LCAxNjYsIDE2NywgMTY4LFxuICAgIDE2OSwgMTcwLCAxNzEsIDE3MiwgMTczLCAxNzQsIDE3NSwgMTc2LCAxNzcsIDE3OCwgMTc5LCAxODAsIDE4MSwgMTgyLCAxODMsIDE4NCxcbiAgICAxODUsIDE4NiwgMTg3LCAxODgsIDE4OSwgMTkwLCAxOTEsIDE5MiwgMTkzLCAxOTQsIDE5NSwgMTk2LCAxOTcsIDE5OCwgMTk5LCAyMDAsXG4gICAgMjAxLCAyMDIsIDIwMywgMjA0LCAyMDUsIDIwNiwgMjA3LCAyMDgsIDIwOSwgMjEwLCAyMTEsIDIxMiwgMjEzLCAyMTQsIDIxNSwgMjE2LFxuICAgIDIxNywgMjE4LCAyMTksIDIyMCwgMjIxLCAyMjIsIDIyMywgMjI0LCAyMjUsIDIyNiwgMjI3LCAyMjgsIDIyOSwgMjMwLCAyMzEsIDIzMixcbiAgICAyMzMsIDIzNCwgMjM1LCAyMzYsIDIzNywgMjM4LCAyMzksIDI0MCwgMjQxLCAyNDIsIDI0MywgMjQ0LCAyNDUsIDI0NiwgMjQ3LFxuICAgIDI0OCwgMjQ5LCAyNTAsIDI1MSwgMjUyLCAyNTMsIDI1NCwgMjU1XTtcbiIsImV4cG9ydCBjb25zdCBkZWZhdWx0TWVzc2FnZXMgPSAnRW5kLU9mLVN0cmVhbSc7XG4vKipcbiAqIFRocm93biBvbiByZWFkIG9wZXJhdGlvbiBvZiB0aGUgZW5kIG9mIGZpbGUgb3Igc3RyZWFtIGhhcyBiZWVuIHJlYWNoZWRcbiAqL1xuZXhwb3J0IGNsYXNzIEVuZE9mU3RyZWFtRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKGRlZmF1bHRNZXNzYWdlcyk7XG4gICAgfVxufVxuIiwiZXhwb3J0IGNsYXNzIERlZmVycmVkIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5yZXNvbHZlID0gKCkgPT4gbnVsbDtcbiAgICAgICAgdGhpcy5yZWplY3QgPSAoKSA9PiBudWxsO1xuICAgICAgICB0aGlzLnByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlamVjdCA9IHJlamVjdDtcbiAgICAgICAgICAgIHRoaXMucmVzb2x2ZSA9IHJlc29sdmU7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cbiIsImltcG9ydCB7IEVuZE9mU3RyZWFtRXJyb3IgfSBmcm9tIFwiLi9FbmRPZlN0cmVhbUVycm9yLmpzXCI7XG5leHBvcnQgY2xhc3MgQWJzdHJhY3RTdHJlYW1SZWFkZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAvKipcbiAgICAgICAgICogTWF4aW11bSByZXF1ZXN0IGxlbmd0aCBvbiByZWFkLXN0cmVhbSBvcGVyYXRpb25cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubWF4U3RyZWFtUmVhZFNpemUgPSAxICogMTAyNCAqIDEwMjQ7XG4gICAgICAgIHRoaXMuZW5kT2ZTdHJlYW0gPSBmYWxzZTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0b3JlIHBlZWtlZCBkYXRhXG4gICAgICAgICAqIEB0eXBlIHtBcnJheX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucGVla1F1ZXVlID0gW107XG4gICAgfVxuICAgIGFzeW5jIHBlZWsodWludDhBcnJheSwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgICAgICAgY29uc3QgYnl0ZXNSZWFkID0gYXdhaXQgdGhpcy5yZWFkKHVpbnQ4QXJyYXksIG9mZnNldCwgbGVuZ3RoKTtcbiAgICAgICAgdGhpcy5wZWVrUXVldWUucHVzaCh1aW50OEFycmF5LnN1YmFycmF5KG9mZnNldCwgb2Zmc2V0ICsgYnl0ZXNSZWFkKSk7IC8vIFB1dCByZWFkIGRhdGEgYmFjayB0byBwZWVrIGJ1ZmZlclxuICAgICAgICByZXR1cm4gYnl0ZXNSZWFkO1xuICAgIH1cbiAgICBhc3luYyByZWFkKGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgICAgICAgaWYgKGxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGJ5dGVzUmVhZCA9IHRoaXMucmVhZEZyb21QZWVrQnVmZmVyKGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgpO1xuICAgICAgICBieXRlc1JlYWQgKz0gYXdhaXQgdGhpcy5yZWFkUmVtYWluZGVyRnJvbVN0cmVhbShidWZmZXIsIG9mZnNldCArIGJ5dGVzUmVhZCwgbGVuZ3RoIC0gYnl0ZXNSZWFkKTtcbiAgICAgICAgaWYgKGJ5dGVzUmVhZCA9PT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVuZE9mU3RyZWFtRXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYnl0ZXNSZWFkO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZWFkIGNodW5rIGZyb20gc3RyZWFtXG4gICAgICogQHBhcmFtIGJ1ZmZlciAtIFRhcmdldCBVaW50OEFycmF5IChvciBCdWZmZXIpIHRvIHN0b3JlIGRhdGEgcmVhZCBmcm9tIHN0cmVhbSBpblxuICAgICAqIEBwYXJhbSBvZmZzZXQgLSBPZmZzZXQgdGFyZ2V0XG4gICAgICogQHBhcmFtIGxlbmd0aCAtIE51bWJlciBvZiBieXRlcyB0byByZWFkXG4gICAgICogQHJldHVybnMgTnVtYmVyIG9mIGJ5dGVzIHJlYWRcbiAgICAgKi9cbiAgICByZWFkRnJvbVBlZWtCdWZmZXIoYnVmZmVyLCBvZmZzZXQsIGxlbmd0aCkge1xuICAgICAgICBsZXQgcmVtYWluaW5nID0gbGVuZ3RoO1xuICAgICAgICBsZXQgYnl0ZXNSZWFkID0gMDtcbiAgICAgICAgLy8gY29uc3VtZSBwZWVrZWQgZGF0YSBmaXJzdFxuICAgICAgICB3aGlsZSAodGhpcy5wZWVrUXVldWUubGVuZ3RoID4gMCAmJiByZW1haW5pbmcgPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBwZWVrRGF0YSA9IHRoaXMucGVla1F1ZXVlLnBvcCgpOyAvLyBGcm9udCBvZiBxdWV1ZVxuICAgICAgICAgICAgaWYgKCFwZWVrRGF0YSlcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BlZWtEYXRhIHNob3VsZCBiZSBkZWZpbmVkJyk7XG4gICAgICAgICAgICBjb25zdCBsZW5Db3B5ID0gTWF0aC5taW4ocGVla0RhdGEubGVuZ3RoLCByZW1haW5pbmcpO1xuICAgICAgICAgICAgYnVmZmVyLnNldChwZWVrRGF0YS5zdWJhcnJheSgwLCBsZW5Db3B5KSwgb2Zmc2V0ICsgYnl0ZXNSZWFkKTtcbiAgICAgICAgICAgIGJ5dGVzUmVhZCArPSBsZW5Db3B5O1xuICAgICAgICAgICAgcmVtYWluaW5nIC09IGxlbkNvcHk7XG4gICAgICAgICAgICBpZiAobGVuQ29weSA8IHBlZWtEYXRhLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIC8vIHJlbWFpbmRlciBiYWNrIHRvIHF1ZXVlXG4gICAgICAgICAgICAgICAgdGhpcy5wZWVrUXVldWUucHVzaChwZWVrRGF0YS5zdWJhcnJheShsZW5Db3B5KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGJ5dGVzUmVhZDtcbiAgICB9XG4gICAgYXN5bmMgcmVhZFJlbWFpbmRlckZyb21TdHJlYW0oYnVmZmVyLCBvZmZzZXQsIGluaXRpYWxSZW1haW5pbmcpIHtcbiAgICAgICAgbGV0IHJlbWFpbmluZyA9IGluaXRpYWxSZW1haW5pbmc7XG4gICAgICAgIGxldCBieXRlc1JlYWQgPSAwO1xuICAgICAgICAvLyBDb250aW51ZSByZWFkaW5nIGZyb20gc3RyZWFtIGlmIHJlcXVpcmVkXG4gICAgICAgIHdoaWxlIChyZW1haW5pbmcgPiAwICYmICF0aGlzLmVuZE9mU3RyZWFtKSB7XG4gICAgICAgICAgICBjb25zdCByZXFMZW4gPSBNYXRoLm1pbihyZW1haW5pbmcsIHRoaXMubWF4U3RyZWFtUmVhZFNpemUpO1xuICAgICAgICAgICAgY29uc3QgY2h1bmtMZW4gPSBhd2FpdCB0aGlzLnJlYWRGcm9tU3RyZWFtKGJ1ZmZlciwgb2Zmc2V0ICsgYnl0ZXNSZWFkLCByZXFMZW4pO1xuICAgICAgICAgICAgaWYgKGNodW5rTGVuID09PSAwKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgYnl0ZXNSZWFkICs9IGNodW5rTGVuO1xuICAgICAgICAgICAgcmVtYWluaW5nIC09IGNodW5rTGVuO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBieXRlc1JlYWQ7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgRW5kT2ZTdHJlYW1FcnJvciB9IGZyb20gJy4vRW5kT2ZTdHJlYW1FcnJvci5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZCB9IGZyb20gJy4vRGVmZXJyZWQuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RTdHJlYW1SZWFkZXIgfSBmcm9tIFwiLi9BYnN0cmFjdFN0cmVhbVJlYWRlci5qc1wiO1xuZXhwb3J0IHsgRW5kT2ZTdHJlYW1FcnJvciB9IGZyb20gJy4vRW5kT2ZTdHJlYW1FcnJvci5qcyc7XG4vKipcbiAqIE5vZGUuanMgUmVhZGFibGUgU3RyZWFtIFJlYWRlclxuICogUmVmOiBodHRwczovL25vZGVqcy5vcmcvYXBpL3N0cmVhbS5odG1sI3JlYWRhYmxlLXN0cmVhbXNcbiAqL1xuZXhwb3J0IGNsYXNzIFN0cmVhbVJlYWRlciBleHRlbmRzIEFic3RyYWN0U3RyZWFtUmVhZGVyIHtcbiAgICBjb25zdHJ1Y3RvcihzKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMucyA9IHM7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEZWZlcnJlZCB1c2VkIGZvciBwb3N0cG9uZWQgcmVhZCByZXF1ZXN0IChhcyBub3QgZGF0YSBpcyB5ZXQgYXZhaWxhYmxlIHRvIHJlYWQpXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmRlZmVycmVkID0gbnVsbDtcbiAgICAgICAgaWYgKCFzLnJlYWQgfHwgIXMub25jZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCBhbiBpbnN0YW5jZSBvZiBzdHJlYW0uUmVhZGFibGUnKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnMub25jZSgnZW5kJywgKCkgPT4gdGhpcy5yZWplY3QobmV3IEVuZE9mU3RyZWFtRXJyb3IoKSkpO1xuICAgICAgICB0aGlzLnMub25jZSgnZXJyb3InLCBlcnIgPT4gdGhpcy5yZWplY3QoZXJyKSk7XG4gICAgICAgIHRoaXMucy5vbmNlKCdjbG9zZScsICgpID0+IHRoaXMucmVqZWN0KG5ldyBFcnJvcignU3RyZWFtIGNsb3NlZCcpKSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJlYWQgY2h1bmsgZnJvbSBzdHJlYW1cbiAgICAgKiBAcGFyYW0gYnVmZmVyIFRhcmdldCBVaW50OEFycmF5IChvciBCdWZmZXIpIHRvIHN0b3JlIGRhdGEgcmVhZCBmcm9tIHN0cmVhbSBpblxuICAgICAqIEBwYXJhbSBvZmZzZXQgT2Zmc2V0IHRhcmdldFxuICAgICAqIEBwYXJhbSBsZW5ndGggTnVtYmVyIG9mIGJ5dGVzIHRvIHJlYWRcbiAgICAgKiBAcmV0dXJucyBOdW1iZXIgb2YgYnl0ZXMgcmVhZFxuICAgICAqL1xuICAgIGFzeW5jIHJlYWRGcm9tU3RyZWFtKGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgICAgICAgaWYgKHRoaXMuZW5kT2ZTdHJlYW0pIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlYWRCdWZmZXIgPSB0aGlzLnMucmVhZChsZW5ndGgpO1xuICAgICAgICBpZiAocmVhZEJ1ZmZlcikge1xuICAgICAgICAgICAgYnVmZmVyLnNldChyZWFkQnVmZmVyLCBvZmZzZXQpO1xuICAgICAgICAgICAgcmV0dXJuIHJlYWRCdWZmZXIubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlcXVlc3QgPSB7XG4gICAgICAgICAgICBidWZmZXIsXG4gICAgICAgICAgICBvZmZzZXQsXG4gICAgICAgICAgICBsZW5ndGgsXG4gICAgICAgICAgICBkZWZlcnJlZDogbmV3IERlZmVycmVkKClcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5kZWZlcnJlZCA9IHJlcXVlc3QuZGVmZXJyZWQ7XG4gICAgICAgIHRoaXMucy5vbmNlKCdyZWFkYWJsZScsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVhZERlZmVycmVkKHJlcXVlc3QpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlcXVlc3QuZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUHJvY2VzcyBkZWZlcnJlZCByZWFkIHJlcXVlc3RcbiAgICAgKiBAcGFyYW0gcmVxdWVzdCBEZWZlcnJlZCByZWFkIHJlcXVlc3RcbiAgICAgKi9cbiAgICByZWFkRGVmZXJyZWQocmVxdWVzdCkge1xuICAgICAgICBjb25zdCByZWFkQnVmZmVyID0gdGhpcy5zLnJlYWQocmVxdWVzdC5sZW5ndGgpO1xuICAgICAgICBpZiAocmVhZEJ1ZmZlcikge1xuICAgICAgICAgICAgcmVxdWVzdC5idWZmZXIuc2V0KHJlYWRCdWZmZXIsIHJlcXVlc3Qub2Zmc2V0KTtcbiAgICAgICAgICAgIHJlcXVlc3QuZGVmZXJyZWQucmVzb2x2ZShyZWFkQnVmZmVyLmxlbmd0aCk7XG4gICAgICAgICAgICB0aGlzLmRlZmVycmVkID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucy5vbmNlKCdyZWFkYWJsZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlYWREZWZlcnJlZChyZXF1ZXN0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJlamVjdChlcnIpIHtcbiAgICAgICAgdGhpcy5lbmRPZlN0cmVhbSA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLmRlZmVycmVkKSB7XG4gICAgICAgICAgICB0aGlzLmRlZmVycmVkLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgdGhpcy5kZWZlcnJlZCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG4gICAgYXN5bmMgYWJvcnQoKSB7XG4gICAgICAgIHRoaXMucy5kZXN0cm95KCk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgRW5kT2ZTdHJlYW1FcnJvciB9IGZyb20gJ3BlZWstcmVhZGFibGUnO1xuLyoqXG4gKiBDb3JlIHRva2VuaXplclxuICovXG5leHBvcnQgY2xhc3MgQWJzdHJhY3RUb2tlbml6ZXIge1xuICAgIGNvbnN0cnVjdG9yKGZpbGVJbmZvKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUb2tlbml6ZXItc3RyZWFtIHBvc2l0aW9uXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnBvc2l0aW9uID0gMDtcbiAgICAgICAgdGhpcy5udW1CdWZmZXIgPSBuZXcgVWludDhBcnJheSg4KTtcbiAgICAgICAgdGhpcy5maWxlSW5mbyA9IGZpbGVJbmZvID8gZmlsZUluZm8gOiB7fTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmVhZCBhIHRva2VuIGZyb20gdGhlIHRva2VuaXplci1zdHJlYW1cbiAgICAgKiBAcGFyYW0gdG9rZW4gLSBUaGUgdG9rZW4gdG8gcmVhZFxuICAgICAqIEBwYXJhbSBwb3NpdGlvbiAtIElmIHByb3ZpZGVkLCB0aGUgZGVzaXJlZCBwb3NpdGlvbiBpbiB0aGUgdG9rZW5pemVyLXN0cmVhbVxuICAgICAqIEByZXR1cm5zIFByb21pc2Ugd2l0aCB0b2tlbiBkYXRhXG4gICAgICovXG4gICAgYXN5bmMgcmVhZFRva2VuKHRva2VuLCBwb3NpdGlvbiA9IHRoaXMucG9zaXRpb24pIHtcbiAgICAgICAgY29uc3QgdWludDhBcnJheSA9IG5ldyBVaW50OEFycmF5KHRva2VuLmxlbik7XG4gICAgICAgIGNvbnN0IGxlbiA9IGF3YWl0IHRoaXMucmVhZEJ1ZmZlcih1aW50OEFycmF5LCB7IHBvc2l0aW9uIH0pO1xuICAgICAgICBpZiAobGVuIDwgdG9rZW4ubGVuKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVuZE9mU3RyZWFtRXJyb3IoKTtcbiAgICAgICAgcmV0dXJuIHRva2VuLmdldCh1aW50OEFycmF5LCAwKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUGVlayBhIHRva2VuIGZyb20gdGhlIHRva2VuaXplci1zdHJlYW0uXG4gICAgICogQHBhcmFtIHRva2VuIC0gVG9rZW4gdG8gcGVlayBmcm9tIHRoZSB0b2tlbml6ZXItc3RyZWFtLlxuICAgICAqIEBwYXJhbSBwb3NpdGlvbiAtIE9mZnNldCB3aGVyZSB0byBiZWdpbiByZWFkaW5nIHdpdGhpbiB0aGUgZmlsZS4gSWYgcG9zaXRpb24gaXMgbnVsbCwgZGF0YSB3aWxsIGJlIHJlYWQgZnJvbSB0aGUgY3VycmVudCBmaWxlIHBvc2l0aW9uLlxuICAgICAqIEByZXR1cm5zIFByb21pc2Ugd2l0aCB0b2tlbiBkYXRhXG4gICAgICovXG4gICAgYXN5bmMgcGVla1Rva2VuKHRva2VuLCBwb3NpdGlvbiA9IHRoaXMucG9zaXRpb24pIHtcbiAgICAgICAgY29uc3QgdWludDhBcnJheSA9IG5ldyBVaW50OEFycmF5KHRva2VuLmxlbik7XG4gICAgICAgIGNvbnN0IGxlbiA9IGF3YWl0IHRoaXMucGVla0J1ZmZlcih1aW50OEFycmF5LCB7IHBvc2l0aW9uIH0pO1xuICAgICAgICBpZiAobGVuIDwgdG9rZW4ubGVuKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVuZE9mU3RyZWFtRXJyb3IoKTtcbiAgICAgICAgcmV0dXJuIHRva2VuLmdldCh1aW50OEFycmF5LCAwKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmVhZCBhIG51bWVyaWMgdG9rZW4gZnJvbSB0aGUgc3RyZWFtXG4gICAgICogQHBhcmFtIHRva2VuIC0gTnVtZXJpYyB0b2tlblxuICAgICAqIEByZXR1cm5zIFByb21pc2Ugd2l0aCBudW1iZXJcbiAgICAgKi9cbiAgICBhc3luYyByZWFkTnVtYmVyKHRva2VuKSB7XG4gICAgICAgIGNvbnN0IGxlbiA9IGF3YWl0IHRoaXMucmVhZEJ1ZmZlcih0aGlzLm51bUJ1ZmZlciwgeyBsZW5ndGg6IHRva2VuLmxlbiB9KTtcbiAgICAgICAgaWYgKGxlbiA8IHRva2VuLmxlbilcbiAgICAgICAgICAgIHRocm93IG5ldyBFbmRPZlN0cmVhbUVycm9yKCk7XG4gICAgICAgIHJldHVybiB0b2tlbi5nZXQodGhpcy5udW1CdWZmZXIsIDApO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZWFkIGEgbnVtZXJpYyB0b2tlbiBmcm9tIHRoZSBzdHJlYW1cbiAgICAgKiBAcGFyYW0gdG9rZW4gLSBOdW1lcmljIHRva2VuXG4gICAgICogQHJldHVybnMgUHJvbWlzZSB3aXRoIG51bWJlclxuICAgICAqL1xuICAgIGFzeW5jIHBlZWtOdW1iZXIodG9rZW4pIHtcbiAgICAgICAgY29uc3QgbGVuID0gYXdhaXQgdGhpcy5wZWVrQnVmZmVyKHRoaXMubnVtQnVmZmVyLCB7IGxlbmd0aDogdG9rZW4ubGVuIH0pO1xuICAgICAgICBpZiAobGVuIDwgdG9rZW4ubGVuKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVuZE9mU3RyZWFtRXJyb3IoKTtcbiAgICAgICAgcmV0dXJuIHRva2VuLmdldCh0aGlzLm51bUJ1ZmZlciwgMCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIElnbm9yZSBudW1iZXIgb2YgYnl0ZXMsIGFkdmFuY2VzIHRoZSBwb2ludGVyIGluIHVuZGVyIHRva2VuaXplci1zdHJlYW0uXG4gICAgICogQHBhcmFtIGxlbmd0aCAtIE51bWJlciBvZiBieXRlcyB0byBpZ25vcmVcbiAgICAgKiBAcmV0dXJuIHJlc29sdmVzIHRoZSBudW1iZXIgb2YgYnl0ZXMgaWdub3JlZCwgZXF1YWxzIGxlbmd0aCBpZiB0aGlzIGF2YWlsYWJsZSwgb3RoZXJ3aXNlIHRoZSBudW1iZXIgb2YgYnl0ZXMgYXZhaWxhYmxlXG4gICAgICovXG4gICAgYXN5bmMgaWdub3JlKGxlbmd0aCkge1xuICAgICAgICBpZiAodGhpcy5maWxlSW5mby5zaXplICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IGJ5dGVzTGVmdCA9IHRoaXMuZmlsZUluZm8uc2l6ZSAtIHRoaXMucG9zaXRpb247XG4gICAgICAgICAgICBpZiAobGVuZ3RoID4gYnl0ZXNMZWZ0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbiArPSBieXRlc0xlZnQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ5dGVzTGVmdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLnBvc2l0aW9uICs9IGxlbmd0aDtcbiAgICAgICAgcmV0dXJuIGxlbmd0aDtcbiAgICB9XG4gICAgYXN5bmMgY2xvc2UoKSB7XG4gICAgICAgIC8vIGVtcHR5XG4gICAgfVxuICAgIG5vcm1hbGl6ZU9wdGlvbnModWludDhBcnJheSwgb3B0aW9ucykge1xuICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnBvc2l0aW9uICE9PSB1bmRlZmluZWQgJiYgb3B0aW9ucy5wb3NpdGlvbiA8IHRoaXMucG9zaXRpb24pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignYG9wdGlvbnMucG9zaXRpb25gIG11c3QgYmUgZXF1YWwgb3IgZ3JlYXRlciB0aGFuIGB0b2tlbml6ZXIucG9zaXRpb25gJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgbWF5QmVMZXNzOiBvcHRpb25zLm1heUJlTGVzcyA9PT0gdHJ1ZSxcbiAgICAgICAgICAgICAgICBvZmZzZXQ6IG9wdGlvbnMub2Zmc2V0ID8gb3B0aW9ucy5vZmZzZXQgOiAwLFxuICAgICAgICAgICAgICAgIGxlbmd0aDogb3B0aW9ucy5sZW5ndGggPyBvcHRpb25zLmxlbmd0aCA6ICh1aW50OEFycmF5Lmxlbmd0aCAtIChvcHRpb25zLm9mZnNldCA/IG9wdGlvbnMub2Zmc2V0IDogMCkpLFxuICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBvcHRpb25zLnBvc2l0aW9uID8gb3B0aW9ucy5wb3NpdGlvbiA6IHRoaXMucG9zaXRpb25cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG1heUJlTGVzczogZmFsc2UsXG4gICAgICAgICAgICBvZmZzZXQ6IDAsXG4gICAgICAgICAgICBsZW5ndGg6IHVpbnQ4QXJyYXkubGVuZ3RoLFxuICAgICAgICAgICAgcG9zaXRpb246IHRoaXMucG9zaXRpb25cbiAgICAgICAgfTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBBYnN0cmFjdFRva2VuaXplciB9IGZyb20gJy4vQWJzdHJhY3RUb2tlbml6ZXIuanMnO1xuaW1wb3J0IHsgRW5kT2ZTdHJlYW1FcnJvciB9IGZyb20gJ3BlZWstcmVhZGFibGUnO1xuY29uc3QgbWF4QnVmZmVyU2l6ZSA9IDI1NjAwMDtcbmV4cG9ydCBjbGFzcyBSZWFkU3RyZWFtVG9rZW5pemVyIGV4dGVuZHMgQWJzdHJhY3RUb2tlbml6ZXIge1xuICAgIGNvbnN0cnVjdG9yKHN0cmVhbVJlYWRlciwgZmlsZUluZm8pIHtcbiAgICAgICAgc3VwZXIoZmlsZUluZm8pO1xuICAgICAgICB0aGlzLnN0cmVhbVJlYWRlciA9IHN0cmVhbVJlYWRlcjtcbiAgICB9XG4gICAgLyoqXG4gICAgICogR2V0IGZpbGUgaW5mb3JtYXRpb24sIGFuIEhUVFAtY2xpZW50IG1heSBpbXBsZW1lbnQgdGhpcyBkb2luZyBhIEhFQUQgcmVxdWVzdFxuICAgICAqIEByZXR1cm4gUHJvbWlzZSB3aXRoIGZpbGUgaW5mb3JtYXRpb25cbiAgICAgKi9cbiAgICBhc3luYyBnZXRGaWxlSW5mbygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmlsZUluZm87XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJlYWQgYnVmZmVyIGZyb20gdG9rZW5pemVyXG4gICAgICogQHBhcmFtIHVpbnQ4QXJyYXkgLSBUYXJnZXQgVWludDhBcnJheSB0byBmaWxsIHdpdGggZGF0YSByZWFkIGZyb20gdGhlIHRva2VuaXplci1zdHJlYW1cbiAgICAgKiBAcGFyYW0gb3B0aW9ucyAtIFJlYWQgYmVoYXZpb3VyIG9wdGlvbnNcbiAgICAgKiBAcmV0dXJucyBQcm9taXNlIHdpdGggbnVtYmVyIG9mIGJ5dGVzIHJlYWRcbiAgICAgKi9cbiAgICBhc3luYyByZWFkQnVmZmVyKHVpbnQ4QXJyYXksIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3Qgbm9ybU9wdGlvbnMgPSB0aGlzLm5vcm1hbGl6ZU9wdGlvbnModWludDhBcnJheSwgb3B0aW9ucyk7XG4gICAgICAgIGNvbnN0IHNraXBCeXRlcyA9IG5vcm1PcHRpb25zLnBvc2l0aW9uIC0gdGhpcy5wb3NpdGlvbjtcbiAgICAgICAgaWYgKHNraXBCeXRlcyA+IDApIHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuaWdub3JlKHNraXBCeXRlcyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yZWFkQnVmZmVyKHVpbnQ4QXJyYXksIG9wdGlvbnMpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHNraXBCeXRlcyA8IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignYG9wdGlvbnMucG9zaXRpb25gIG11c3QgYmUgZXF1YWwgb3IgZ3JlYXRlciB0aGFuIGB0b2tlbml6ZXIucG9zaXRpb25gJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vcm1PcHRpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYnl0ZXNSZWFkID0gYXdhaXQgdGhpcy5zdHJlYW1SZWFkZXIucmVhZCh1aW50OEFycmF5LCBub3JtT3B0aW9ucy5vZmZzZXQsIG5vcm1PcHRpb25zLmxlbmd0aCk7XG4gICAgICAgIHRoaXMucG9zaXRpb24gKz0gYnl0ZXNSZWFkO1xuICAgICAgICBpZiAoKCFvcHRpb25zIHx8ICFvcHRpb25zLm1heUJlTGVzcykgJiYgYnl0ZXNSZWFkIDwgbm9ybU9wdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRW5kT2ZTdHJlYW1FcnJvcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBieXRlc1JlYWQ7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFBlZWsgKHJlYWQgYWhlYWQpIGJ1ZmZlciBmcm9tIHRva2VuaXplclxuICAgICAqIEBwYXJhbSB1aW50OEFycmF5IC0gVWludDhBcnJheSAob3IgQnVmZmVyKSB0byB3cml0ZSBkYXRhIHRvXG4gICAgICogQHBhcmFtIG9wdGlvbnMgLSBSZWFkIGJlaGF2aW91ciBvcHRpb25zXG4gICAgICogQHJldHVybnMgUHJvbWlzZSB3aXRoIG51bWJlciBvZiBieXRlcyBwZWVrZWRcbiAgICAgKi9cbiAgICBhc3luYyBwZWVrQnVmZmVyKHVpbnQ4QXJyYXksIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3Qgbm9ybU9wdGlvbnMgPSB0aGlzLm5vcm1hbGl6ZU9wdGlvbnModWludDhBcnJheSwgb3B0aW9ucyk7XG4gICAgICAgIGxldCBieXRlc1JlYWQgPSAwO1xuICAgICAgICBpZiAobm9ybU9wdGlvbnMucG9zaXRpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IHNraXBCeXRlcyA9IG5vcm1PcHRpb25zLnBvc2l0aW9uIC0gdGhpcy5wb3NpdGlvbjtcbiAgICAgICAgICAgIGlmIChza2lwQnl0ZXMgPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2tpcEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KG5vcm1PcHRpb25zLmxlbmd0aCArIHNraXBCeXRlcyk7XG4gICAgICAgICAgICAgICAgYnl0ZXNSZWFkID0gYXdhaXQgdGhpcy5wZWVrQnVmZmVyKHNraXBCdWZmZXIsIHsgbWF5QmVMZXNzOiBub3JtT3B0aW9ucy5tYXlCZUxlc3MgfSk7XG4gICAgICAgICAgICAgICAgdWludDhBcnJheS5zZXQoc2tpcEJ1ZmZlci5zdWJhcnJheShza2lwQnl0ZXMpLCBub3JtT3B0aW9ucy5vZmZzZXQpO1xuICAgICAgICAgICAgICAgIHJldHVybiBieXRlc1JlYWQgLSBza2lwQnl0ZXM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChza2lwQnl0ZXMgPCAwKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgcGVlayBmcm9tIGEgbmVnYXRpdmUgb2Zmc2V0IGluIGEgc3RyZWFtJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vcm1PcHRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYnl0ZXNSZWFkID0gYXdhaXQgdGhpcy5zdHJlYW1SZWFkZXIucGVlayh1aW50OEFycmF5LCBub3JtT3B0aW9ucy5vZmZzZXQsIG5vcm1PcHRpb25zLmxlbmd0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5tYXlCZUxlc3MgJiYgZXJyIGluc3RhbmNlb2YgRW5kT2ZTdHJlYW1FcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCghbm9ybU9wdGlvbnMubWF5QmVMZXNzKSAmJiBieXRlc1JlYWQgPCBub3JtT3B0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRW5kT2ZTdHJlYW1FcnJvcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBieXRlc1JlYWQ7XG4gICAgfVxuICAgIGFzeW5jIGlnbm9yZShsZW5ndGgpIHtcbiAgICAgICAgLy8gZGVidWcoYGlnbm9yZSAke3RoaXMucG9zaXRpb259Li4uJHt0aGlzLnBvc2l0aW9uICsgbGVuZ3RoIC0gMX1gKTtcbiAgICAgICAgY29uc3QgYnVmU2l6ZSA9IE1hdGgubWluKG1heEJ1ZmZlclNpemUsIGxlbmd0aCk7XG4gICAgICAgIGNvbnN0IGJ1ZiA9IG5ldyBVaW50OEFycmF5KGJ1ZlNpemUpO1xuICAgICAgICBsZXQgdG90Qnl0ZXNSZWFkID0gMDtcbiAgICAgICAgd2hpbGUgKHRvdEJ5dGVzUmVhZCA8IGxlbmd0aCkge1xuICAgICAgICAgICAgY29uc3QgcmVtYWluaW5nID0gbGVuZ3RoIC0gdG90Qnl0ZXNSZWFkO1xuICAgICAgICAgICAgY29uc3QgYnl0ZXNSZWFkID0gYXdhaXQgdGhpcy5yZWFkQnVmZmVyKGJ1ZiwgeyBsZW5ndGg6IE1hdGgubWluKGJ1ZlNpemUsIHJlbWFpbmluZykgfSk7XG4gICAgICAgICAgICBpZiAoYnl0ZXNSZWFkIDwgMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBieXRlc1JlYWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0b3RCeXRlc1JlYWQgKz0gYnl0ZXNSZWFkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0b3RCeXRlc1JlYWQ7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgRW5kT2ZTdHJlYW1FcnJvciB9IGZyb20gJ3BlZWstcmVhZGFibGUnO1xuaW1wb3J0IHsgQWJzdHJhY3RUb2tlbml6ZXIgfSBmcm9tICcuL0Fic3RyYWN0VG9rZW5pemVyLmpzJztcbmV4cG9ydCBjbGFzcyBCdWZmZXJUb2tlbml6ZXIgZXh0ZW5kcyBBYnN0cmFjdFRva2VuaXplciB7XG4gICAgLyoqXG4gICAgICogQ29uc3RydWN0IEJ1ZmZlclRva2VuaXplclxuICAgICAqIEBwYXJhbSB1aW50OEFycmF5IC0gVWludDhBcnJheSB0byB0b2tlbml6ZVxuICAgICAqIEBwYXJhbSBmaWxlSW5mbyAtIFBhc3MgYWRkaXRpb25hbCBmaWxlIGluZm9ybWF0aW9uIHRvIHRoZSB0b2tlbml6ZXJcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcih1aW50OEFycmF5LCBmaWxlSW5mbykge1xuICAgICAgICBzdXBlcihmaWxlSW5mbyk7XG4gICAgICAgIHRoaXMudWludDhBcnJheSA9IHVpbnQ4QXJyYXk7XG4gICAgICAgIHRoaXMuZmlsZUluZm8uc2l6ZSA9IHRoaXMuZmlsZUluZm8uc2l6ZSA/IHRoaXMuZmlsZUluZm8uc2l6ZSA6IHVpbnQ4QXJyYXkubGVuZ3RoO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZWFkIGJ1ZmZlciBmcm9tIHRva2VuaXplclxuICAgICAqIEBwYXJhbSB1aW50OEFycmF5IC0gVWludDhBcnJheSB0byB0b2tlbml6ZVxuICAgICAqIEBwYXJhbSBvcHRpb25zIC0gUmVhZCBiZWhhdmlvdXIgb3B0aW9uc1xuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG51bWJlcj59XG4gICAgICovXG4gICAgYXN5bmMgcmVhZEJ1ZmZlcih1aW50OEFycmF5LCBvcHRpb25zKSB7XG4gICAgICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMucG9zaXRpb24pIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnBvc2l0aW9uIDwgdGhpcy5wb3NpdGlvbikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignYG9wdGlvbnMucG9zaXRpb25gIG11c3QgYmUgZXF1YWwgb3IgZ3JlYXRlciB0aGFuIGB0b2tlbml6ZXIucG9zaXRpb25gJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnBvc2l0aW9uID0gb3B0aW9ucy5wb3NpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBieXRlc1JlYWQgPSBhd2FpdCB0aGlzLnBlZWtCdWZmZXIodWludDhBcnJheSwgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMucG9zaXRpb24gKz0gYnl0ZXNSZWFkO1xuICAgICAgICByZXR1cm4gYnl0ZXNSZWFkO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBQZWVrIChyZWFkIGFoZWFkKSBidWZmZXIgZnJvbSB0b2tlbml6ZXJcbiAgICAgKiBAcGFyYW0gdWludDhBcnJheVxuICAgICAqIEBwYXJhbSBvcHRpb25zIC0gUmVhZCBiZWhhdmlvdXIgb3B0aW9uc1xuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG51bWJlcj59XG4gICAgICovXG4gICAgYXN5bmMgcGVla0J1ZmZlcih1aW50OEFycmF5LCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IG5vcm1PcHRpb25zID0gdGhpcy5ub3JtYWxpemVPcHRpb25zKHVpbnQ4QXJyYXksIG9wdGlvbnMpO1xuICAgICAgICBjb25zdCBieXRlczJyZWFkID0gTWF0aC5taW4odGhpcy51aW50OEFycmF5Lmxlbmd0aCAtIG5vcm1PcHRpb25zLnBvc2l0aW9uLCBub3JtT3B0aW9ucy5sZW5ndGgpO1xuICAgICAgICBpZiAoKCFub3JtT3B0aW9ucy5tYXlCZUxlc3MpICYmIGJ5dGVzMnJlYWQgPCBub3JtT3B0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFbmRPZlN0cmVhbUVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB1aW50OEFycmF5LnNldCh0aGlzLnVpbnQ4QXJyYXkuc3ViYXJyYXkobm9ybU9wdGlvbnMucG9zaXRpb24sIG5vcm1PcHRpb25zLnBvc2l0aW9uICsgYnl0ZXMycmVhZCksIG5vcm1PcHRpb25zLm9mZnNldCk7XG4gICAgICAgICAgICByZXR1cm4gYnl0ZXMycmVhZDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBhc3luYyBjbG9zZSgpIHtcbiAgICAgICAgLy8gZW1wdHlcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBSZWFkU3RyZWFtVG9rZW5pemVyIH0gZnJvbSAnLi9SZWFkU3RyZWFtVG9rZW5pemVyLmpzJztcbmltcG9ydCB7IEJ1ZmZlclRva2VuaXplciB9IGZyb20gJy4vQnVmZmVyVG9rZW5pemVyLmpzJztcbmltcG9ydCB7IFN0cmVhbVJlYWRlciwgV2ViU3RyZWFtUmVhZGVyIH0gZnJvbSAncGVlay1yZWFkYWJsZSc7XG5leHBvcnQgeyBFbmRPZlN0cmVhbUVycm9yIH0gZnJvbSAncGVlay1yZWFkYWJsZSc7XG4vKipcbiAqIENvbnN0cnVjdCBSZWFkU3RyZWFtVG9rZW5pemVyIGZyb20gZ2l2ZW4gU3RyZWFtLlxuICogV2lsbCBzZXQgZmlsZVNpemUsIGlmIHByb3ZpZGVkIGdpdmVuIFN0cmVhbSBoYXMgc2V0IHRoZSAucGF0aCBwcm9wZXJ0eS9cbiAqIEBwYXJhbSBzdHJlYW0gLSBSZWFkIGZyb20gTm9kZS5qcyBTdHJlYW0uUmVhZGFibGVcbiAqIEBwYXJhbSBmaWxlSW5mbyAtIFBhc3MgdGhlIGZpbGUgaW5mb3JtYXRpb24sIGxpa2Ugc2l6ZSBhbmQgTUlNRS10eXBlIG9mIHRoZSBjb3JyZXNwb25kaW5nIHN0cmVhbS5cbiAqIEByZXR1cm5zIFJlYWRTdHJlYW1Ub2tlbml6ZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZyb21TdHJlYW0oc3RyZWFtLCBmaWxlSW5mbykge1xuICAgIGZpbGVJbmZvID0gZmlsZUluZm8gPyBmaWxlSW5mbyA6IHt9O1xuICAgIHJldHVybiBuZXcgUmVhZFN0cmVhbVRva2VuaXplcihuZXcgU3RyZWFtUmVhZGVyKHN0cmVhbSksIGZpbGVJbmZvKTtcbn1cbi8qKlxuICogQ29uc3RydWN0IFJlYWRTdHJlYW1Ub2tlbml6ZXIgZnJvbSBnaXZlbiBSZWFkYWJsZVN0cmVhbSAoV2ViU3RyZWFtIEFQSSkuXG4gKiBXaWxsIHNldCBmaWxlU2l6ZSwgaWYgcHJvdmlkZWQgZ2l2ZW4gU3RyZWFtIGhhcyBzZXQgdGhlIC5wYXRoIHByb3BlcnR5L1xuICogQHBhcmFtIHdlYlN0cmVhbSAtIFJlYWQgZnJvbSBOb2RlLmpzIFN0cmVhbS5SZWFkYWJsZVxuICogQHBhcmFtIGZpbGVJbmZvIC0gUGFzcyB0aGUgZmlsZSBpbmZvcm1hdGlvbiwgbGlrZSBzaXplIGFuZCBNSU1FLXR5cGUgb2YgdGhlIGNvcnJlc3BvbmRpbmcgc3RyZWFtLlxuICogQHJldHVybnMgUmVhZFN0cmVhbVRva2VuaXplclxuICovXG5leHBvcnQgZnVuY3Rpb24gZnJvbVdlYlN0cmVhbSh3ZWJTdHJlYW0sIGZpbGVJbmZvKSB7XG4gICAgZmlsZUluZm8gPSBmaWxlSW5mbyA/IGZpbGVJbmZvIDoge307XG4gICAgcmV0dXJuIG5ldyBSZWFkU3RyZWFtVG9rZW5pemVyKG5ldyBXZWJTdHJlYW1SZWFkZXIod2ViU3RyZWFtKSwgZmlsZUluZm8pO1xufVxuLyoqXG4gKiBDb25zdHJ1Y3QgUmVhZFN0cmVhbVRva2VuaXplciBmcm9tIGdpdmVuIEJ1ZmZlci5cbiAqIEBwYXJhbSB1aW50OEFycmF5IC0gVWludDhBcnJheSB0byB0b2tlbml6ZVxuICogQHBhcmFtIGZpbGVJbmZvIC0gUGFzcyBhZGRpdGlvbmFsIGZpbGUgaW5mb3JtYXRpb24gdG8gdGhlIHRva2VuaXplclxuICogQHJldHVybnMgQnVmZmVyVG9rZW5pemVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmcm9tQnVmZmVyKHVpbnQ4QXJyYXksIGZpbGVJbmZvKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXJUb2tlbml6ZXIodWludDhBcnJheSwgZmlsZUluZm8pO1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIHN0cmluZ1RvQnl0ZXMoc3RyaW5nKSB7XG5cdHJldHVybiBbLi4uc3RyaW5nXS5tYXAoY2hhcmFjdGVyID0+IGNoYXJhY3Rlci5jaGFyQ29kZUF0KDApKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSB1bmljb3JuL3ByZWZlci1jb2RlLXBvaW50XG59XG5cbi8qKlxuQ2hlY2tzIHdoZXRoZXIgdGhlIFRBUiBjaGVja3N1bSBpcyB2YWxpZC5cblxuQHBhcmFtIHtCdWZmZXJ9IGJ1ZmZlciAtIFRoZSBUQVIgaGVhZGVyIGBbb2Zmc2V0IC4uLiBvZmZzZXQgKyA1MTJdYC5cbkBwYXJhbSB7bnVtYmVyfSBvZmZzZXQgLSBUQVIgaGVhZGVyIG9mZnNldC5cbkByZXR1cm5zIHtib29sZWFufSBgdHJ1ZWAgaWYgdGhlIFRBUiBjaGVja3N1bSBpcyB2YWxpZCwgb3RoZXJ3aXNlIGBmYWxzZWAuXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIHRhckhlYWRlckNoZWNrc3VtTWF0Y2hlcyhidWZmZXIsIG9mZnNldCA9IDApIHtcblx0Y29uc3QgcmVhZFN1bSA9IE51bWJlci5wYXJzZUludChidWZmZXIudG9TdHJpbmcoJ3V0ZjgnLCAxNDgsIDE1NCkucmVwbGFjZSgvXFwwLiokLywgJycpLnRyaW0oKSwgOCk7IC8vIFJlYWQgc3VtIGluIGhlYWRlclxuXHRpZiAoTnVtYmVyLmlzTmFOKHJlYWRTdW0pKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0bGV0IHN1bSA9IDggKiAweDIwOyAvLyBJbml0aWFsaXplIHNpZ25lZCBiaXQgc3VtXG5cblx0Zm9yIChsZXQgaW5kZXggPSBvZmZzZXQ7IGluZGV4IDwgb2Zmc2V0ICsgMTQ4OyBpbmRleCsrKSB7XG5cdFx0c3VtICs9IGJ1ZmZlcltpbmRleF07XG5cdH1cblxuXHRmb3IgKGxldCBpbmRleCA9IG9mZnNldCArIDE1NjsgaW5kZXggPCBvZmZzZXQgKyA1MTI7IGluZGV4KyspIHtcblx0XHRzdW0gKz0gYnVmZmVyW2luZGV4XTtcblx0fVxuXG5cdHJldHVybiByZWFkU3VtID09PSBzdW07XG59XG5cbi8qKlxuSUQzIFVJTlQzMiBzeW5jLXNhZmUgdG9rZW5pemVyIHRva2VuLlxuMjggYml0cyAocmVwcmVzZW50aW5nIHVwIHRvIDI1Nk1CKSBpbnRlZ2VyLCB0aGUgbXNiIGlzIDAgdG8gYXZvaWQgXCJmYWxzZSBzeW5jc2lnbmFsc1wiLlxuKi9cbmV4cG9ydCBjb25zdCB1aW50MzJTeW5jU2FmZVRva2VuID0ge1xuXHRnZXQ6IChidWZmZXIsIG9mZnNldCkgPT4gKGJ1ZmZlcltvZmZzZXQgKyAzXSAmIDB4N0YpIHwgKChidWZmZXJbb2Zmc2V0ICsgMl0pIDw8IDcpIHwgKChidWZmZXJbb2Zmc2V0ICsgMV0pIDw8IDE0KSB8ICgoYnVmZmVyW29mZnNldF0pIDw8IDIxKSxcblx0bGVuOiA0LFxufTtcbiIsImV4cG9ydCBjb25zdCBleHRlbnNpb25zID0gW1xuXHQnanBnJyxcblx0J3BuZycsXG5cdCdhcG5nJyxcblx0J2dpZicsXG5cdCd3ZWJwJyxcblx0J2ZsaWYnLFxuXHQneGNmJyxcblx0J2NyMicsXG5cdCdjcjMnLFxuXHQnb3JmJyxcblx0J2FydycsXG5cdCdkbmcnLFxuXHQnbmVmJyxcblx0J3J3MicsXG5cdCdyYWYnLFxuXHQndGlmJyxcblx0J2JtcCcsXG5cdCdpY25zJyxcblx0J2p4cicsXG5cdCdwc2QnLFxuXHQnaW5kZCcsXG5cdCd6aXAnLFxuXHQndGFyJyxcblx0J3JhcicsXG5cdCdneicsXG5cdCdiejInLFxuXHQnN3onLFxuXHQnZG1nJyxcblx0J21wNCcsXG5cdCdtaWQnLFxuXHQnbWt2Jyxcblx0J3dlYm0nLFxuXHQnbW92Jyxcblx0J2F2aScsXG5cdCdtcGcnLFxuXHQnbXAyJyxcblx0J21wMycsXG5cdCdtNGEnLFxuXHQnb2dhJyxcblx0J29nZycsXG5cdCdvZ3YnLFxuXHQnb3B1cycsXG5cdCdmbGFjJyxcblx0J3dhdicsXG5cdCdzcHgnLFxuXHQnYW1yJyxcblx0J3BkZicsXG5cdCdlcHViJyxcblx0J2VsZicsXG5cdCdtYWNobycsXG5cdCdleGUnLFxuXHQnc3dmJyxcblx0J3J0ZicsXG5cdCd3YXNtJyxcblx0J3dvZmYnLFxuXHQnd29mZjInLFxuXHQnZW90Jyxcblx0J3R0ZicsXG5cdCdvdGYnLFxuXHQnaWNvJyxcblx0J2ZsdicsXG5cdCdwcycsXG5cdCd4eicsXG5cdCdzcWxpdGUnLFxuXHQnbmVzJyxcblx0J2NyeCcsXG5cdCd4cGknLFxuXHQnY2FiJyxcblx0J2RlYicsXG5cdCdhcicsXG5cdCdycG0nLFxuXHQnWicsXG5cdCdseicsXG5cdCdjZmInLFxuXHQnbXhmJyxcblx0J210cycsXG5cdCdibGVuZCcsXG5cdCdicGcnLFxuXHQnZG9jeCcsXG5cdCdwcHR4Jyxcblx0J3hsc3gnLFxuXHQnM2dwJyxcblx0JzNnMicsXG5cdCdqMmMnLFxuXHQnanAyJyxcblx0J2pwbScsXG5cdCdqcHgnLFxuXHQnbWoyJyxcblx0J2FpZicsXG5cdCdxY3AnLFxuXHQnb2R0Jyxcblx0J29kcycsXG5cdCdvZHAnLFxuXHQneG1sJyxcblx0J21vYmknLFxuXHQnaGVpYycsXG5cdCdjdXInLFxuXHQna3R4Jyxcblx0J2FwZScsXG5cdCd3dicsXG5cdCdkY20nLFxuXHQnaWNzJyxcblx0J2dsYicsXG5cdCdwY2FwJyxcblx0J2RzZicsXG5cdCdsbmsnLFxuXHQnYWxpYXMnLFxuXHQndm9jJyxcblx0J2FjMycsXG5cdCdtNHYnLFxuXHQnbTRwJyxcblx0J200YicsXG5cdCdmNHYnLFxuXHQnZjRwJyxcblx0J2Y0YicsXG5cdCdmNGEnLFxuXHQnbWllJyxcblx0J2FzZicsXG5cdCdvZ20nLFxuXHQnb2d4Jyxcblx0J21wYycsXG5cdCdhcnJvdycsXG5cdCdzaHAnLFxuXHQnYWFjJyxcblx0J21wMScsXG5cdCdpdCcsXG5cdCdzM20nLFxuXHQneG0nLFxuXHQnYWknLFxuXHQnc2twJyxcblx0J2F2aWYnLFxuXHQnZXBzJyxcblx0J2x6aCcsXG5cdCdwZ3AnLFxuXHQnYXNhcicsXG5cdCdzdGwnLFxuXHQnY2htJyxcblx0JzNtZicsXG5cdCd6c3QnLFxuXHQnanhsJyxcblx0J3ZjZicsXG5cdCdqbHMnLFxuXHQncHN0Jyxcblx0J2R3ZycsXG5cdCdwYXJxdWV0Jyxcblx0J2NsYXNzJyxcblx0J2FyaicsXG5cdCdjcGlvJyxcblx0J2FjZScsXG5cdCdhdnJvJyxcblx0J2ljYycsXG5cdCdmYngnLFxuXTtcblxuZXhwb3J0IGNvbnN0IG1pbWVUeXBlcyA9IFtcblx0J2ltYWdlL2pwZWcnLFxuXHQnaW1hZ2UvcG5nJyxcblx0J2ltYWdlL2dpZicsXG5cdCdpbWFnZS93ZWJwJyxcblx0J2ltYWdlL2ZsaWYnLFxuXHQnaW1hZ2UveC14Y2YnLFxuXHQnaW1hZ2UveC1jYW5vbi1jcjInLFxuXHQnaW1hZ2UveC1jYW5vbi1jcjMnLFxuXHQnaW1hZ2UvdGlmZicsXG5cdCdpbWFnZS9ibXAnLFxuXHQnaW1hZ2Uvdm5kLm1zLXBob3RvJyxcblx0J2ltYWdlL3ZuZC5hZG9iZS5waG90b3Nob3AnLFxuXHQnYXBwbGljYXRpb24veC1pbmRlc2lnbicsXG5cdCdhcHBsaWNhdGlvbi9lcHViK3ppcCcsXG5cdCdhcHBsaWNhdGlvbi94LXhwaW5zdGFsbCcsXG5cdCdhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LnRleHQnLFxuXHQnYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC5zcHJlYWRzaGVldCcsXG5cdCdhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LnByZXNlbnRhdGlvbicsXG5cdCdhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQud29yZHByb2Nlc3NpbmdtbC5kb2N1bWVudCcsXG5cdCdhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQucHJlc2VudGF0aW9ubWwucHJlc2VudGF0aW9uJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC5zcHJlYWRzaGVldG1sLnNoZWV0Jyxcblx0J2FwcGxpY2F0aW9uL3ppcCcsXG5cdCdhcHBsaWNhdGlvbi94LXRhcicsXG5cdCdhcHBsaWNhdGlvbi94LXJhci1jb21wcmVzc2VkJyxcblx0J2FwcGxpY2F0aW9uL2d6aXAnLFxuXHQnYXBwbGljYXRpb24veC1iemlwMicsXG5cdCdhcHBsaWNhdGlvbi94LTd6LWNvbXByZXNzZWQnLFxuXHQnYXBwbGljYXRpb24veC1hcHBsZS1kaXNraW1hZ2UnLFxuXHQnYXBwbGljYXRpb24veC1hcGFjaGUtYXJyb3cnLFxuXHQndmlkZW8vbXA0Jyxcblx0J2F1ZGlvL21pZGknLFxuXHQndmlkZW8veC1tYXRyb3NrYScsXG5cdCd2aWRlby93ZWJtJyxcblx0J3ZpZGVvL3F1aWNrdGltZScsXG5cdCd2aWRlby92bmQuYXZpJyxcblx0J2F1ZGlvL3ZuZC53YXZlJyxcblx0J2F1ZGlvL3FjZWxwJyxcblx0J2F1ZGlvL3gtbXMtYXNmJyxcblx0J3ZpZGVvL3gtbXMtYXNmJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5tcy1hc2YnLFxuXHQndmlkZW8vbXBlZycsXG5cdCd2aWRlby8zZ3BwJyxcblx0J2F1ZGlvL21wZWcnLFxuXHQnYXVkaW8vbXA0JywgLy8gUkZDIDQzMzdcblx0J2F1ZGlvL29wdXMnLFxuXHQndmlkZW8vb2dnJyxcblx0J2F1ZGlvL29nZycsXG5cdCdhcHBsaWNhdGlvbi9vZ2cnLFxuXHQnYXVkaW8veC1mbGFjJyxcblx0J2F1ZGlvL2FwZScsXG5cdCdhdWRpby93YXZwYWNrJyxcblx0J2F1ZGlvL2FtcicsXG5cdCdhcHBsaWNhdGlvbi9wZGYnLFxuXHQnYXBwbGljYXRpb24veC1lbGYnLFxuXHQnYXBwbGljYXRpb24veC1tYWNoLWJpbmFyeScsXG5cdCdhcHBsaWNhdGlvbi94LW1zZG93bmxvYWQnLFxuXHQnYXBwbGljYXRpb24veC1zaG9ja3dhdmUtZmxhc2gnLFxuXHQnYXBwbGljYXRpb24vcnRmJyxcblx0J2FwcGxpY2F0aW9uL3dhc20nLFxuXHQnZm9udC93b2ZmJyxcblx0J2ZvbnQvd29mZjInLFxuXHQnYXBwbGljYXRpb24vdm5kLm1zLWZvbnRvYmplY3QnLFxuXHQnZm9udC90dGYnLFxuXHQnZm9udC9vdGYnLFxuXHQnaW1hZ2UveC1pY29uJyxcblx0J3ZpZGVvL3gtZmx2Jyxcblx0J2FwcGxpY2F0aW9uL3Bvc3RzY3JpcHQnLFxuXHQnYXBwbGljYXRpb24vZXBzJyxcblx0J2FwcGxpY2F0aW9uL3gteHonLFxuXHQnYXBwbGljYXRpb24veC1zcWxpdGUzJyxcblx0J2FwcGxpY2F0aW9uL3gtbmludGVuZG8tbmVzLXJvbScsXG5cdCdhcHBsaWNhdGlvbi94LWdvb2dsZS1jaHJvbWUtZXh0ZW5zaW9uJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5tcy1jYWItY29tcHJlc3NlZCcsXG5cdCdhcHBsaWNhdGlvbi94LWRlYicsXG5cdCdhcHBsaWNhdGlvbi94LXVuaXgtYXJjaGl2ZScsXG5cdCdhcHBsaWNhdGlvbi94LXJwbScsXG5cdCdhcHBsaWNhdGlvbi94LWNvbXByZXNzJyxcblx0J2FwcGxpY2F0aW9uL3gtbHppcCcsXG5cdCdhcHBsaWNhdGlvbi94LWNmYicsXG5cdCdhcHBsaWNhdGlvbi94LW1pZScsXG5cdCdhcHBsaWNhdGlvbi9teGYnLFxuXHQndmlkZW8vbXAydCcsXG5cdCdhcHBsaWNhdGlvbi94LWJsZW5kZXInLFxuXHQnaW1hZ2UvYnBnJyxcblx0J2ltYWdlL2oyYycsXG5cdCdpbWFnZS9qcDInLFxuXHQnaW1hZ2UvanB4Jyxcblx0J2ltYWdlL2pwbScsXG5cdCdpbWFnZS9tajInLFxuXHQnYXVkaW8vYWlmZicsXG5cdCdhcHBsaWNhdGlvbi94bWwnLFxuXHQnYXBwbGljYXRpb24veC1tb2JpcG9ja2V0LWVib29rJyxcblx0J2ltYWdlL2hlaWYnLFxuXHQnaW1hZ2UvaGVpZi1zZXF1ZW5jZScsXG5cdCdpbWFnZS9oZWljJyxcblx0J2ltYWdlL2hlaWMtc2VxdWVuY2UnLFxuXHQnaW1hZ2UvaWNucycsXG5cdCdpbWFnZS9rdHgnLFxuXHQnYXBwbGljYXRpb24vZGljb20nLFxuXHQnYXVkaW8veC1tdXNlcGFjaycsXG5cdCd0ZXh0L2NhbGVuZGFyJyxcblx0J3RleHQvdmNhcmQnLFxuXHQnbW9kZWwvZ2x0Zi1iaW5hcnknLFxuXHQnYXBwbGljYXRpb24vdm5kLnRjcGR1bXAucGNhcCcsXG5cdCdhdWRpby94LWRzZicsIC8vIE5vbi1zdGFuZGFyZFxuXHQnYXBwbGljYXRpb24veC5tcy5zaG9ydGN1dCcsIC8vIEludmVudGVkIGJ5IHVzXG5cdCdhcHBsaWNhdGlvbi94LmFwcGxlLmFsaWFzJywgLy8gSW52ZW50ZWQgYnkgdXNcblx0J2F1ZGlvL3gtdm9jJyxcblx0J2F1ZGlvL3ZuZC5kb2xieS5kZC1yYXcnLFxuXHQnYXVkaW8veC1tNGEnLFxuXHQnaW1hZ2UvYXBuZycsXG5cdCdpbWFnZS94LW9seW1wdXMtb3JmJyxcblx0J2ltYWdlL3gtc29ueS1hcncnLFxuXHQnaW1hZ2UveC1hZG9iZS1kbmcnLFxuXHQnaW1hZ2UveC1uaWtvbi1uZWYnLFxuXHQnaW1hZ2UveC1wYW5hc29uaWMtcncyJyxcblx0J2ltYWdlL3gtZnVqaWZpbG0tcmFmJyxcblx0J3ZpZGVvL3gtbTR2Jyxcblx0J3ZpZGVvLzNncHAyJyxcblx0J2FwcGxpY2F0aW9uL3gtZXNyaS1zaGFwZScsXG5cdCdhdWRpby9hYWMnLFxuXHQnYXVkaW8veC1pdCcsXG5cdCdhdWRpby94LXMzbScsXG5cdCdhdWRpby94LXhtJyxcblx0J3ZpZGVvL01QMVMnLFxuXHQndmlkZW8vTVAyUCcsXG5cdCdhcHBsaWNhdGlvbi92bmQuc2tldGNodXAuc2twJyxcblx0J2ltYWdlL2F2aWYnLFxuXHQnYXBwbGljYXRpb24veC1semgtY29tcHJlc3NlZCcsXG5cdCdhcHBsaWNhdGlvbi9wZ3AtZW5jcnlwdGVkJyxcblx0J2FwcGxpY2F0aW9uL3gtYXNhcicsXG5cdCdtb2RlbC9zdGwnLFxuXHQnYXBwbGljYXRpb24vdm5kLm1zLWh0bWxoZWxwJyxcblx0J21vZGVsLzNtZicsXG5cdCdpbWFnZS9qeGwnLFxuXHQnYXBwbGljYXRpb24venN0ZCcsXG5cdCdpbWFnZS9qbHMnLFxuXHQnYXBwbGljYXRpb24vdm5kLm1zLW91dGxvb2snLFxuXHQnaW1hZ2Uvdm5kLmR3ZycsXG5cdCdhcHBsaWNhdGlvbi94LXBhcnF1ZXQnLFxuXHQnYXBwbGljYXRpb24vamF2YS12bScsXG5cdCdhcHBsaWNhdGlvbi94LWFyaicsXG5cdCdhcHBsaWNhdGlvbi94LWNwaW8nLFxuXHQnYXBwbGljYXRpb24veC1hY2UtY29tcHJlc3NlZCcsXG5cdCdhcHBsaWNhdGlvbi9hdnJvJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5pY2Nwcm9maWxlJyxcblx0J2FwcGxpY2F0aW9uL3guYXV0b2Rlc2suZmJ4JywgLy8gSW52ZW50ZWQgYnkgdXNcbl07XG4iLCJpbXBvcnQge0J1ZmZlcn0gZnJvbSAnbm9kZTpidWZmZXInO1xuaW1wb3J0ICogYXMgVG9rZW4gZnJvbSAndG9rZW4tdHlwZXMnO1xuaW1wb3J0ICogYXMgc3RydG9rMyBmcm9tICdzdHJ0b2szL2NvcmUnOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG4vZmlsZS1leHRlbnNpb24taW4taW1wb3J0XG5pbXBvcnQge1xuXHRzdHJpbmdUb0J5dGVzLFxuXHR0YXJIZWFkZXJDaGVja3N1bU1hdGNoZXMsXG5cdHVpbnQzMlN5bmNTYWZlVG9rZW4sXG59IGZyb20gJy4vdXRpbC5qcyc7XG5pbXBvcnQge2V4dGVuc2lvbnMsIG1pbWVUeXBlc30gZnJvbSAnLi9zdXBwb3J0ZWQuanMnO1xuXG5jb25zdCBtaW5pbXVtQnl0ZXMgPSA0MTAwOyAvLyBBIGZhaXIgYW1vdW50IG9mIGZpbGUtdHlwZXMgYXJlIGRldGVjdGFibGUgd2l0aGluIHRoaXMgcmFuZ2UuXG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmaWxlVHlwZUZyb21TdHJlYW0oc3RyZWFtKSB7XG5cdHJldHVybiBuZXcgRmlsZVR5cGVQYXJzZXIoKS5mcm9tU3RyZWFtKHN0cmVhbSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmaWxlVHlwZUZyb21CdWZmZXIoaW5wdXQpIHtcblx0cmV0dXJuIG5ldyBGaWxlVHlwZVBhcnNlcigpLmZyb21CdWZmZXIoaW5wdXQpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmlsZVR5cGVGcm9tQmxvYihibG9iKSB7XG5cdHJldHVybiBuZXcgRmlsZVR5cGVQYXJzZXIoKS5mcm9tQmxvYihibG9iKTtcbn1cblxuZnVuY3Rpb24gX2NoZWNrKGJ1ZmZlciwgaGVhZGVycywgb3B0aW9ucykge1xuXHRvcHRpb25zID0ge1xuXHRcdG9mZnNldDogMCxcblx0XHQuLi5vcHRpb25zLFxuXHR9O1xuXG5cdGZvciAoY29uc3QgW2luZGV4LCBoZWFkZXJdIG9mIGhlYWRlcnMuZW50cmllcygpKSB7XG5cdFx0Ly8gSWYgYSBiaXRtYXNrIGlzIHNldFxuXHRcdGlmIChvcHRpb25zLm1hc2spIHtcblx0XHRcdC8vIElmIGhlYWRlciBkb2Vzbid0IGVxdWFsIGBidWZgIHdpdGggYml0cyBtYXNrZWQgb2ZmXG5cdFx0XHRpZiAoaGVhZGVyICE9PSAob3B0aW9ucy5tYXNrW2luZGV4XSAmIGJ1ZmZlcltpbmRleCArIG9wdGlvbnMub2Zmc2V0XSkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoaGVhZGVyICE9PSBidWZmZXJbaW5kZXggKyBvcHRpb25zLm9mZnNldF0pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbGVUeXBlRnJvbVRva2VuaXplcih0b2tlbml6ZXIpIHtcblx0cmV0dXJuIG5ldyBGaWxlVHlwZVBhcnNlcigpLmZyb21Ub2tlbml6ZXIodG9rZW5pemVyKTtcbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVUeXBlUGFyc2VyIHtcblx0Y29uc3RydWN0b3Iob3B0aW9ucykge1xuXHRcdHRoaXMuZGV0ZWN0b3JzID0gb3B0aW9ucz8uY3VzdG9tRGV0ZWN0b3JzO1xuXG5cdFx0dGhpcy5mcm9tVG9rZW5pemVyID0gdGhpcy5mcm9tVG9rZW5pemVyLmJpbmQodGhpcyk7XG5cdFx0dGhpcy5mcm9tQnVmZmVyID0gdGhpcy5mcm9tQnVmZmVyLmJpbmQodGhpcyk7XG5cdFx0dGhpcy5wYXJzZSA9IHRoaXMucGFyc2UuYmluZCh0aGlzKTtcblx0fVxuXG5cdGFzeW5jIGZyb21Ub2tlbml6ZXIodG9rZW5pemVyKSB7XG5cdFx0Y29uc3QgaW5pdGlhbFBvc2l0aW9uID0gdG9rZW5pemVyLnBvc2l0aW9uO1xuXG5cdFx0Zm9yIChjb25zdCBkZXRlY3RvciBvZiB0aGlzLmRldGVjdG9ycyB8fCBbXSkge1xuXHRcdFx0Y29uc3QgZmlsZVR5cGUgPSBhd2FpdCBkZXRlY3Rvcih0b2tlbml6ZXIpO1xuXHRcdFx0aWYgKGZpbGVUeXBlKSB7XG5cdFx0XHRcdHJldHVybiBmaWxlVHlwZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGluaXRpYWxQb3NpdGlvbiAhPT0gdG9rZW5pemVyLnBvc2l0aW9uKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7IC8vIENhbm5vdCBwcm9jZWVkIHNjYW5uaW5nIG9mIHRoZSB0b2tlbml6ZXIgaXMgYXQgYW4gYXJiaXRyYXJ5IHBvc2l0aW9uXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMucGFyc2UodG9rZW5pemVyKTtcblx0fVxuXG5cdGFzeW5jIGZyb21CdWZmZXIoaW5wdXQpIHtcblx0XHRpZiAoIShpbnB1dCBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkgfHwgaW5wdXQgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikpIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoYEV4cGVjdGVkIHRoZSBcXGBpbnB1dFxcYCBhcmd1bWVudCB0byBiZSBvZiB0eXBlIFxcYFVpbnQ4QXJyYXlcXGAgb3IgXFxgQnVmZmVyXFxgIG9yIFxcYEFycmF5QnVmZmVyXFxgLCBnb3QgXFxgJHt0eXBlb2YgaW5wdXR9XFxgYCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYnVmZmVyID0gaW5wdXQgaW5zdGFuY2VvZiBVaW50OEFycmF5ID8gaW5wdXQgOiBuZXcgVWludDhBcnJheShpbnB1dCk7XG5cblx0XHRpZiAoIShidWZmZXI/Lmxlbmd0aCA+IDEpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZnJvbVRva2VuaXplcihzdHJ0b2szLmZyb21CdWZmZXIoYnVmZmVyKSk7XG5cdH1cblxuXHRhc3luYyBmcm9tQmxvYihibG9iKSB7XG5cdFx0Y29uc3QgYnVmZmVyID0gYXdhaXQgYmxvYi5hcnJheUJ1ZmZlcigpO1xuXHRcdHJldHVybiB0aGlzLmZyb21CdWZmZXIobmV3IFVpbnQ4QXJyYXkoYnVmZmVyKSk7XG5cdH1cblxuXHRhc3luYyBmcm9tU3RyZWFtKHN0cmVhbSkge1xuXHRcdGNvbnN0IHRva2VuaXplciA9IGF3YWl0IHN0cnRvazMuZnJvbVN0cmVhbShzdHJlYW0pO1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5mcm9tVG9rZW5pemVyKHRva2VuaXplcik7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGF3YWl0IHRva2VuaXplci5jbG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHRvRGV0ZWN0aW9uU3RyZWFtKHJlYWRhYmxlU3RyZWFtLCBvcHRpb25zID0ge30pIHtcblx0XHRjb25zdCB7ZGVmYXVsdDogc3RyZWFtfSA9IGF3YWl0IGltcG9ydCgnbm9kZTpzdHJlYW0nKTtcblx0XHRjb25zdCB7c2FtcGxlU2l6ZSA9IG1pbmltdW1CeXRlc30gPSBvcHRpb25zO1xuXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdHJlYWRhYmxlU3RyZWFtLm9uKCdlcnJvcicsIHJlamVjdCk7XG5cblx0XHRcdHJlYWRhYmxlU3RyZWFtLm9uY2UoJ3JlYWRhYmxlJywgKCkgPT4ge1xuXHRcdFx0XHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHQvLyBTZXQgdXAgb3V0cHV0IHN0cmVhbVxuXHRcdFx0XHRcdFx0Y29uc3QgcGFzcyA9IG5ldyBzdHJlYW0uUGFzc1Rocm91Z2goKTtcblx0XHRcdFx0XHRcdGNvbnN0IG91dHB1dFN0cmVhbSA9IHN0cmVhbS5waXBlbGluZSA/IHN0cmVhbS5waXBlbGluZShyZWFkYWJsZVN0cmVhbSwgcGFzcywgKCkgPT4ge30pIDogcmVhZGFibGVTdHJlYW0ucGlwZShwYXNzKTtcblxuXHRcdFx0XHRcdFx0Ly8gUmVhZCB0aGUgaW5wdXQgc3RyZWFtIGFuZCBkZXRlY3QgdGhlIGZpbGV0eXBlXG5cdFx0XHRcdFx0XHRjb25zdCBjaHVuayA9IHJlYWRhYmxlU3RyZWFtLnJlYWQoc2FtcGxlU2l6ZSkgPz8gcmVhZGFibGVTdHJlYW0ucmVhZCgpID8/IEJ1ZmZlci5hbGxvYygwKTtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdHBhc3MuZmlsZVR5cGUgPSBhd2FpdCB0aGlzLmZyb21CdWZmZXIoY2h1bmspO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdFx0aWYgKGVycm9yIGluc3RhbmNlb2Ygc3RydG9rMy5FbmRPZlN0cmVhbUVycm9yKSB7XG5cdFx0XHRcdFx0XHRcdFx0cGFzcy5maWxlVHlwZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRyZWplY3QoZXJyb3IpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHJlc29sdmUob3V0cHV0U3RyZWFtKTtcblx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0cmVqZWN0KGVycm9yKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdGNoZWNrKGhlYWRlciwgb3B0aW9ucykge1xuXHRcdHJldHVybiBfY2hlY2sodGhpcy5idWZmZXIsIGhlYWRlciwgb3B0aW9ucyk7XG5cdH1cblxuXHRjaGVja1N0cmluZyhoZWFkZXIsIG9wdGlvbnMpIHtcblx0XHRyZXR1cm4gdGhpcy5jaGVjayhzdHJpbmdUb0J5dGVzKGhlYWRlciksIG9wdGlvbnMpO1xuXHR9XG5cblx0YXN5bmMgcGFyc2UodG9rZW5pemVyKSB7XG5cdFx0dGhpcy5idWZmZXIgPSBCdWZmZXIuYWxsb2MobWluaW11bUJ5dGVzKTtcblxuXHRcdC8vIEtlZXAgcmVhZGluZyB1bnRpbCBFT0YgaWYgdGhlIGZpbGUgc2l6ZSBpcyB1bmtub3duLlxuXHRcdGlmICh0b2tlbml6ZXIuZmlsZUluZm8uc2l6ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0b2tlbml6ZXIuZmlsZUluZm8uc2l6ZSA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuXHRcdH1cblxuXHRcdHRoaXMudG9rZW5pemVyID0gdG9rZW5pemVyO1xuXG5cdFx0YXdhaXQgdG9rZW5pemVyLnBlZWtCdWZmZXIodGhpcy5idWZmZXIsIHtsZW5ndGg6IDEyLCBtYXlCZUxlc3M6IHRydWV9KTtcblxuXHRcdC8vIC0tIDItYnl0ZSBzaWduYXR1cmVzIC0tXG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0MiwgMHg0RF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdibXAnLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2UvYm1wJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MEIsIDB4NzddKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnYWMzJyxcblx0XHRcdFx0bWltZTogJ2F1ZGlvL3ZuZC5kb2xieS5kZC1yYXcnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg3OCwgMHgwMV0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdkbWcnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1hcHBsZS1kaXNraW1hZ2UnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0RCwgMHg1QV0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdleGUnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1tc2Rvd25sb2FkJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MjUsIDB4MjFdKSkge1xuXHRcdFx0YXdhaXQgdG9rZW5pemVyLnBlZWtCdWZmZXIodGhpcy5idWZmZXIsIHtsZW5ndGg6IDI0LCBtYXlCZUxlc3M6IHRydWV9KTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHR0aGlzLmNoZWNrU3RyaW5nKCdQUy1BZG9iZS0nLCB7b2Zmc2V0OiAyfSlcblx0XHRcdFx0JiYgdGhpcy5jaGVja1N0cmluZygnIEVQU0YtJywge29mZnNldDogMTR9KVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnZXBzJyxcblx0XHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vZXBzJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAncHMnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vcG9zdHNjcmlwdCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdHRoaXMuY2hlY2soWzB4MUYsIDB4QTBdKVxuXHRcdFx0fHwgdGhpcy5jaGVjayhbMHgxRiwgMHg5RF0pXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdaJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtY29tcHJlc3MnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhDNywgMHg3MV0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdjcGlvJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtY3BpbycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDYwLCAweEVBXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2FyaicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWFyaicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIC0tIDMtYnl0ZSBzaWduYXR1cmVzIC0tXG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhFRiwgMHhCQiwgMHhCRl0pKSB7IC8vIFVURi04LUJPTVxuXHRcdFx0Ly8gU3RyaXAgb2ZmIFVURi04LUJPTVxuXHRcdFx0dGhpcy50b2tlbml6ZXIuaWdub3JlKDMpO1xuXHRcdFx0cmV0dXJuIHRoaXMucGFyc2UodG9rZW5pemVyKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0NywgMHg0OSwgMHg0Nl0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdnaWYnLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2UvZ2lmJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NDksIDB4NDksIDB4QkNdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnanhyJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL3ZuZC5tcy1waG90bycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDFGLCAweDhCLCAweDhdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZ3onLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vZ3ppcCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDQyLCAweDVBLCAweDY4XSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2J6MicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWJ6aXAyJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0lEMycpKSB7XG5cdFx0XHRhd2FpdCB0b2tlbml6ZXIuaWdub3JlKDYpOyAvLyBTa2lwIElEMyBoZWFkZXIgdW50aWwgdGhlIGhlYWRlciBzaXplXG5cdFx0XHRjb25zdCBpZDNIZWFkZXJMZW5ndGggPSBhd2FpdCB0b2tlbml6ZXIucmVhZFRva2VuKHVpbnQzMlN5bmNTYWZlVG9rZW4pO1xuXHRcdFx0aWYgKHRva2VuaXplci5wb3NpdGlvbiArIGlkM0hlYWRlckxlbmd0aCA+IHRva2VuaXplci5maWxlSW5mby5zaXplKSB7XG5cdFx0XHRcdC8vIEd1ZXNzIGZpbGUgdHlwZSBiYXNlZCBvbiBJRDMgaGVhZGVyIGZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnbXAzJyxcblx0XHRcdFx0XHRtaW1lOiAnYXVkaW8vbXBlZycsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUoaWQzSGVhZGVyTGVuZ3RoKTtcblx0XHRcdHJldHVybiB0aGlzLmZyb21Ub2tlbml6ZXIodG9rZW5pemVyKTsgLy8gU2tpcCBJRDMgaGVhZGVyLCByZWN1cnNpb25cblx0XHR9XG5cblx0XHQvLyBNdXNlcGFjaywgU1Y3XG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ01QKycpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdtcGMnLFxuXHRcdFx0XHRtaW1lOiAnYXVkaW8veC1tdXNlcGFjaycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdCh0aGlzLmJ1ZmZlclswXSA9PT0gMHg0MyB8fCB0aGlzLmJ1ZmZlclswXSA9PT0gMHg0Nilcblx0XHRcdCYmIHRoaXMuY2hlY2soWzB4NTcsIDB4NTNdLCB7b2Zmc2V0OiAxfSlcblx0XHQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3N3ZicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LXNob2Nrd2F2ZS1mbGFzaCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIC0tIDQtYnl0ZSBzaWduYXR1cmVzIC0tXG5cblx0XHQvLyBSZXF1aXJlcyBhIHNhbXBsZSBzaXplIG9mIDQgYnl0ZXNcblx0XHRpZiAodGhpcy5jaGVjayhbMHhGRiwgMHhEOCwgMHhGRl0pKSB7XG5cdFx0XHRpZiAodGhpcy5jaGVjayhbMHhGN10sIHtvZmZzZXQ6IDN9KSkgeyAvLyBKUEc3L1NPRjU1LCBpbmRpY2F0aW5nIGEgSVNPL0lFQyAxNDQ5NSAvIEpQRUctTFMgZmlsZVxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ2pscycsXG5cdFx0XHRcdFx0bWltZTogJ2ltYWdlL2pscycsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2pwZycsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS9qcGVnJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NEYsIDB4NjIsIDB4NkEsIDB4MDFdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnYXZybycsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9hdnJvJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0ZMSUYnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZmxpZicsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS9mbGlmJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJzhCUFMnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAncHNkJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL3ZuZC5hZG9iZS5waG90b3Nob3AnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnV0VCUCcsIHtvZmZzZXQ6IDh9KSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnd2VicCcsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS93ZWJwJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gTXVzZXBhY2ssIFNWOFxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdNUENLJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ21wYycsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby94LW11c2VwYWNrJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0ZPUk0nKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnYWlmJyxcblx0XHRcdFx0bWltZTogJ2F1ZGlvL2FpZmYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnaWNucycsIHtvZmZzZXQ6IDB9KSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnaWNucycsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS9pY25zJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gWmlwLWJhc2VkIGZpbGUgZm9ybWF0c1xuXHRcdC8vIE5lZWQgdG8gYmUgYmVmb3JlIHRoZSBgemlwYCBjaGVja1xuXHRcdGlmICh0aGlzLmNoZWNrKFsweDUwLCAweDRCLCAweDMsIDB4NF0pKSB7IC8vIExvY2FsIGZpbGUgaGVhZGVyIHNpZ25hdHVyZVxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0d2hpbGUgKHRva2VuaXplci5wb3NpdGlvbiArIDMwIDwgdG9rZW5pemVyLmZpbGVJbmZvLnNpemUpIHtcblx0XHRcdFx0XHRhd2FpdCB0b2tlbml6ZXIucmVhZEJ1ZmZlcih0aGlzLmJ1ZmZlciwge2xlbmd0aDogMzB9KTtcblxuXHRcdFx0XHRcdC8vIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1ppcF8oZmlsZV9mb3JtYXQpI0ZpbGVfaGVhZGVyc1xuXHRcdFx0XHRcdGNvbnN0IHppcEhlYWRlciA9IHtcblx0XHRcdFx0XHRcdGNvbXByZXNzZWRTaXplOiB0aGlzLmJ1ZmZlci5yZWFkVUludDMyTEUoMTgpLFxuXHRcdFx0XHRcdFx0dW5jb21wcmVzc2VkU2l6ZTogdGhpcy5idWZmZXIucmVhZFVJbnQzMkxFKDIyKSxcblx0XHRcdFx0XHRcdGZpbGVuYW1lTGVuZ3RoOiB0aGlzLmJ1ZmZlci5yZWFkVUludDE2TEUoMjYpLFxuXHRcdFx0XHRcdFx0ZXh0cmFGaWVsZExlbmd0aDogdGhpcy5idWZmZXIucmVhZFVJbnQxNkxFKDI4KSxcblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0emlwSGVhZGVyLmZpbGVuYW1lID0gYXdhaXQgdG9rZW5pemVyLnJlYWRUb2tlbihuZXcgVG9rZW4uU3RyaW5nVHlwZSh6aXBIZWFkZXIuZmlsZW5hbWVMZW5ndGgsICd1dGYtOCcpKTtcblx0XHRcdFx0XHRhd2FpdCB0b2tlbml6ZXIuaWdub3JlKHppcEhlYWRlci5leHRyYUZpZWxkTGVuZ3RoKTtcblxuXHRcdFx0XHRcdC8vIEFzc3VtZXMgc2lnbmVkIGAueHBpYCBmcm9tIGFkZG9ucy5tb3ppbGxhLm9yZ1xuXHRcdFx0XHRcdGlmICh6aXBIZWFkZXIuZmlsZW5hbWUgPT09ICdNRVRBLUlORi9tb3ppbGxhLnJzYScpIHtcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdGV4dDogJ3hwaScsXG5cdFx0XHRcdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LXhwaW5zdGFsbCcsXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICh6aXBIZWFkZXIuZmlsZW5hbWUuZW5kc1dpdGgoJy5yZWxzJykgfHwgemlwSGVhZGVyLmZpbGVuYW1lLmVuZHNXaXRoKCcueG1sJykpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHR5cGUgPSB6aXBIZWFkZXIuZmlsZW5hbWUuc3BsaXQoJy8nKVswXTtcblx0XHRcdFx0XHRcdHN3aXRjaCAodHlwZSkge1xuXHRcdFx0XHRcdFx0XHRjYXNlICdfcmVscyc6XG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdGNhc2UgJ3dvcmQnOlxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRleHQ6ICdkb2N4Jyxcblx0XHRcdFx0XHRcdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQud29yZHByb2Nlc3NpbmdtbC5kb2N1bWVudCcsXG5cdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0Y2FzZSAncHB0Jzpcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZXh0OiAncHB0eCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LnByZXNlbnRhdGlvbm1sLnByZXNlbnRhdGlvbicsXG5cdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0Y2FzZSAneGwnOlxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRleHQ6ICd4bHN4Jyxcblx0XHRcdFx0XHRcdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC5zaGVldCcsXG5cdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoemlwSGVhZGVyLmZpbGVuYW1lLnN0YXJ0c1dpdGgoJ3hsLycpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRleHQ6ICd4bHN4Jyxcblx0XHRcdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC5zcHJlYWRzaGVldG1sLnNoZWV0Jyxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHppcEhlYWRlci5maWxlbmFtZS5zdGFydHNXaXRoKCczRC8nKSAmJiB6aXBIZWFkZXIuZmlsZW5hbWUuZW5kc1dpdGgoJy5tb2RlbCcpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRleHQ6ICczbWYnLFxuXHRcdFx0XHRcdFx0XHRtaW1lOiAnbW9kZWwvM21mJyxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gVGhlIGRvY3gsIHhsc3ggYW5kIHBwdHggZmlsZSB0eXBlcyBleHRlbmQgdGhlIE9mZmljZSBPcGVuIFhNTCBmaWxlIGZvcm1hdDpcblx0XHRcdFx0XHQvLyBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9PZmZpY2VfT3Blbl9YTUxfZmlsZV9mb3JtYXRzXG5cdFx0XHRcdFx0Ly8gV2UgbG9vayBmb3I6XG5cdFx0XHRcdFx0Ly8gLSBvbmUgZW50cnkgbmFtZWQgJ1tDb250ZW50X1R5cGVzXS54bWwnIG9yICdfcmVscy8ucmVscycsXG5cdFx0XHRcdFx0Ly8gLSBvbmUgZW50cnkgaW5kaWNhdGluZyBzcGVjaWZpYyB0eXBlIG9mIGZpbGUuXG5cdFx0XHRcdFx0Ly8gTVMgT2ZmaWNlLCBPcGVuT2ZmaWNlIGFuZCBMaWJyZU9mZmljZSBtYXkgcHV0IHRoZSBwYXJ0cyBpbiBkaWZmZXJlbnQgb3JkZXIsIHNvIHRoZSBjaGVjayBzaG91bGQgbm90IHJlbHkgb24gaXQuXG5cdFx0XHRcdFx0aWYgKHppcEhlYWRlci5maWxlbmFtZSA9PT0gJ21pbWV0eXBlJyAmJiB6aXBIZWFkZXIuY29tcHJlc3NlZFNpemUgPT09IHppcEhlYWRlci51bmNvbXByZXNzZWRTaXplKSB7XG5cdFx0XHRcdFx0XHRsZXQgbWltZVR5cGUgPSBhd2FpdCB0b2tlbml6ZXIucmVhZFRva2VuKG5ldyBUb2tlbi5TdHJpbmdUeXBlKHppcEhlYWRlci5jb21wcmVzc2VkU2l6ZSwgJ3V0Zi04JykpO1xuXHRcdFx0XHRcdFx0bWltZVR5cGUgPSBtaW1lVHlwZS50cmltKCk7XG5cblx0XHRcdFx0XHRcdHN3aXRjaCAobWltZVR5cGUpIHtcblx0XHRcdFx0XHRcdFx0Y2FzZSAnYXBwbGljYXRpb24vZXB1Yit6aXAnOlxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRleHQ6ICdlcHViJyxcblx0XHRcdFx0XHRcdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9lcHViK3ppcCcsXG5cdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0Y2FzZSAnYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC50ZXh0Jzpcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZXh0OiAnb2R0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LnRleHQnLFxuXHRcdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdGNhc2UgJ2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQuc3ByZWFkc2hlZXQnOlxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRleHQ6ICdvZHMnLFxuXHRcdFx0XHRcdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQuc3ByZWFkc2hlZXQnLFxuXHRcdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdGNhc2UgJ2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQucHJlc2VudGF0aW9uJzpcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZXh0OiAnb2RwJyxcblx0XHRcdFx0XHRcdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LnByZXNlbnRhdGlvbicsXG5cdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBUcnkgdG8gZmluZCBuZXh0IGhlYWRlciBtYW51YWxseSB3aGVuIGN1cnJlbnQgb25lIGlzIGNvcnJ1cHRlZFxuXHRcdFx0XHRcdGlmICh6aXBIZWFkZXIuY29tcHJlc3NlZFNpemUgPT09IDApIHtcblx0XHRcdFx0XHRcdGxldCBuZXh0SGVhZGVySW5kZXggPSAtMTtcblxuXHRcdFx0XHRcdFx0d2hpbGUgKG5leHRIZWFkZXJJbmRleCA8IDAgJiYgKHRva2VuaXplci5wb3NpdGlvbiA8IHRva2VuaXplci5maWxlSW5mby5zaXplKSkge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0b2tlbml6ZXIucGVla0J1ZmZlcih0aGlzLmJ1ZmZlciwge21heUJlTGVzczogdHJ1ZX0pO1xuXG5cdFx0XHRcdFx0XHRcdG5leHRIZWFkZXJJbmRleCA9IHRoaXMuYnVmZmVyLmluZGV4T2YoJzUwNEIwMzA0JywgMCwgJ2hleCcpO1xuXHRcdFx0XHRcdFx0XHQvLyBNb3ZlIHBvc2l0aW9uIHRvIHRoZSBuZXh0IGhlYWRlciBpZiBmb3VuZCwgc2tpcCB0aGUgd2hvbGUgYnVmZmVyIG90aGVyd2lzZVxuXHRcdFx0XHRcdFx0XHRhd2FpdCB0b2tlbml6ZXIuaWdub3JlKG5leHRIZWFkZXJJbmRleCA+PSAwID8gbmV4dEhlYWRlckluZGV4IDogdGhpcy5idWZmZXIubGVuZ3RoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0YXdhaXQgdG9rZW5pemVyLmlnbm9yZSh6aXBIZWFkZXIuY29tcHJlc3NlZFNpemUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0aWYgKCEoZXJyb3IgaW5zdGFuY2VvZiBzdHJ0b2szLkVuZE9mU3RyZWFtRXJyb3IpKSB7XG5cdFx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnemlwJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ppcCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdPZ2dTJykpIHtcblx0XHRcdC8vIFRoaXMgaXMgYW4gT0dHIGNvbnRhaW5lclxuXHRcdFx0YXdhaXQgdG9rZW5pemVyLmlnbm9yZSgyOCk7XG5cdFx0XHRjb25zdCB0eXBlID0gQnVmZmVyLmFsbG9jKDgpO1xuXHRcdFx0YXdhaXQgdG9rZW5pemVyLnJlYWRCdWZmZXIodHlwZSk7XG5cblx0XHRcdC8vIE5lZWRzIHRvIGJlIGJlZm9yZSBgb2dnYCBjaGVja1xuXHRcdFx0aWYgKF9jaGVjayh0eXBlLCBbMHg0RiwgMHg3MCwgMHg3NSwgMHg3MywgMHg0OCwgMHg2NSwgMHg2MSwgMHg2NF0pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnb3B1cycsXG5cdFx0XHRcdFx0bWltZTogJ2F1ZGlvL29wdXMnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBJZiAnIHRoZW9yYScgaW4gaGVhZGVyLlxuXHRcdFx0aWYgKF9jaGVjayh0eXBlLCBbMHg4MCwgMHg3NCwgMHg2OCwgMHg2NSwgMHg2RiwgMHg3MiwgMHg2MV0pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnb2d2Jyxcblx0XHRcdFx0XHRtaW1lOiAndmlkZW8vb2dnJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgJ1xceDAxdmlkZW8nIGluIGhlYWRlci5cblx0XHRcdGlmIChfY2hlY2sodHlwZSwgWzB4MDEsIDB4NzYsIDB4NjksIDB4NjQsIDB4NjUsIDB4NkYsIDB4MDBdKSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ29nbScsXG5cdFx0XHRcdFx0bWltZTogJ3ZpZGVvL29nZycsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmICcgRkxBQycgaW4gaGVhZGVyICBodHRwczovL3hpcGgub3JnL2ZsYWMvZmFxLmh0bWxcblx0XHRcdGlmIChfY2hlY2sodHlwZSwgWzB4N0YsIDB4NDYsIDB4NEMsIDB4NDEsIDB4NDNdKSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ29nYScsXG5cdFx0XHRcdFx0bWltZTogJ2F1ZGlvL29nZycsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdC8vICdTcGVleCAgJyBpbiBoZWFkZXIgaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvU3BlZXhcblx0XHRcdGlmIChfY2hlY2sodHlwZSwgWzB4NTMsIDB4NzAsIDB4NjUsIDB4NjUsIDB4NzgsIDB4MjAsIDB4MjBdKSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ3NweCcsXG5cdFx0XHRcdFx0bWltZTogJ2F1ZGlvL29nZycsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmICdcXHgwMXZvcmJpcycgaW4gaGVhZGVyXG5cdFx0XHRpZiAoX2NoZWNrKHR5cGUsIFsweDAxLCAweDc2LCAweDZGLCAweDcyLCAweDYyLCAweDY5LCAweDczXSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdvZ2cnLFxuXHRcdFx0XHRcdG1pbWU6ICdhdWRpby9vZ2cnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBEZWZhdWx0IE9HRyBjb250YWluZXIgaHR0cHM6Ly93d3cuaWFuYS5vcmcvYXNzaWdubWVudHMvbWVkaWEtdHlwZXMvYXBwbGljYXRpb24vb2dnXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdvZ3gnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vb2dnJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5jaGVjayhbMHg1MCwgMHg0Ql0pXG5cdFx0XHQmJiAodGhpcy5idWZmZXJbMl0gPT09IDB4MyB8fCB0aGlzLmJ1ZmZlclsyXSA9PT0gMHg1IHx8IHRoaXMuYnVmZmVyWzJdID09PSAweDcpXG5cdFx0XHQmJiAodGhpcy5idWZmZXJbM10gPT09IDB4NCB8fCB0aGlzLmJ1ZmZlclszXSA9PT0gMHg2IHx8IHRoaXMuYnVmZmVyWzNdID09PSAweDgpXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd6aXAnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vemlwJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly9cblxuXHRcdC8vIEZpbGUgVHlwZSBCb3ggKGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0lTT19iYXNlX21lZGlhX2ZpbGVfZm9ybWF0KVxuXHRcdC8vIEl0J3Mgbm90IHJlcXVpcmVkIHRvIGJlIGZpcnN0LCBidXQgaXQncyByZWNvbW1lbmRlZCB0byBiZS4gQWxtb3N0IGFsbCBJU08gYmFzZSBtZWRpYSBmaWxlcyBzdGFydCB3aXRoIGBmdHlwYCBib3guXG5cdFx0Ly8gYGZ0eXBgIGJveCBtdXN0IGNvbnRhaW4gYSBicmFuZCBtYWpvciBpZGVudGlmaWVyLCB3aGljaCBtdXN0IGNvbnNpc3Qgb2YgSVNPIDg4NTktMSBwcmludGFibGUgY2hhcmFjdGVycy5cblx0XHQvLyBIZXJlIHdlIGNoZWNrIGZvciA4ODU5LTEgcHJpbnRhYmxlIGNoYXJhY3RlcnMgKGZvciBzaW1wbGljaXR5LCBpdCdzIGEgbWFzayB3aGljaCBhbHNvIGNhdGNoZXMgb25lIG5vbi1wcmludGFibGUgY2hhcmFjdGVyKS5cblx0XHRpZiAoXG5cdFx0XHR0aGlzLmNoZWNrU3RyaW5nKCdmdHlwJywge29mZnNldDogNH0pXG5cdFx0XHQmJiAodGhpcy5idWZmZXJbOF0gJiAweDYwKSAhPT0gMHgwMCAvLyBCcmFuZCBtYWpvciwgZmlyc3QgY2hhcmFjdGVyIEFTQ0lJP1xuXHRcdCkge1xuXHRcdFx0Ly8gVGhleSBhbGwgY2FuIGhhdmUgTUlNRSBgdmlkZW8vbXA0YCBleGNlcHQgYGFwcGxpY2F0aW9uL21wNGAgc3BlY2lhbC1jYXNlIHdoaWNoIGlzIGhhcmQgdG8gZGV0ZWN0LlxuXHRcdFx0Ly8gRm9yIHNvbWUgY2FzZXMsIHdlJ3JlIHNwZWNpZmljLCBldmVyeXRoaW5nIGVsc2UgZmFsbHMgdG8gYHZpZGVvL21wNGAgd2l0aCBgbXA0YCBleHRlbnNpb24uXG5cdFx0XHRjb25zdCBicmFuZE1ham9yID0gdGhpcy5idWZmZXIudG9TdHJpbmcoJ2JpbmFyeScsIDgsIDEyKS5yZXBsYWNlKCdcXDAnLCAnICcpLnRyaW0oKTtcblx0XHRcdHN3aXRjaCAoYnJhbmRNYWpvcikge1xuXHRcdFx0XHRjYXNlICdhdmlmJzpcblx0XHRcdFx0Y2FzZSAnYXZpcyc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdhdmlmJywgbWltZTogJ2ltYWdlL2F2aWYnfTtcblx0XHRcdFx0Y2FzZSAnbWlmMSc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdoZWljJywgbWltZTogJ2ltYWdlL2hlaWYnfTtcblx0XHRcdFx0Y2FzZSAnbXNmMSc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdoZWljJywgbWltZTogJ2ltYWdlL2hlaWYtc2VxdWVuY2UnfTtcblx0XHRcdFx0Y2FzZSAnaGVpYyc6XG5cdFx0XHRcdGNhc2UgJ2hlaXgnOlxuXHRcdFx0XHRcdHJldHVybiB7ZXh0OiAnaGVpYycsIG1pbWU6ICdpbWFnZS9oZWljJ307XG5cdFx0XHRcdGNhc2UgJ2hldmMnOlxuXHRcdFx0XHRjYXNlICdoZXZ4Jzpcblx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJ2hlaWMnLCBtaW1lOiAnaW1hZ2UvaGVpYy1zZXF1ZW5jZSd9O1xuXHRcdFx0XHRjYXNlICdxdCc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdtb3YnLCBtaW1lOiAndmlkZW8vcXVpY2t0aW1lJ307XG5cdFx0XHRcdGNhc2UgJ000Vic6XG5cdFx0XHRcdGNhc2UgJ000VkgnOlxuXHRcdFx0XHRjYXNlICdNNFZQJzpcblx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJ200dicsIG1pbWU6ICd2aWRlby94LW00did9O1xuXHRcdFx0XHRjYXNlICdNNFAnOlxuXHRcdFx0XHRcdHJldHVybiB7ZXh0OiAnbTRwJywgbWltZTogJ3ZpZGVvL21wNCd9O1xuXHRcdFx0XHRjYXNlICdNNEInOlxuXHRcdFx0XHRcdHJldHVybiB7ZXh0OiAnbTRiJywgbWltZTogJ2F1ZGlvL21wNCd9O1xuXHRcdFx0XHRjYXNlICdNNEEnOlxuXHRcdFx0XHRcdHJldHVybiB7ZXh0OiAnbTRhJywgbWltZTogJ2F1ZGlvL3gtbTRhJ307XG5cdFx0XHRcdGNhc2UgJ0Y0Vic6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdmNHYnLCBtaW1lOiAndmlkZW8vbXA0J307XG5cdFx0XHRcdGNhc2UgJ0Y0UCc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdmNHAnLCBtaW1lOiAndmlkZW8vbXA0J307XG5cdFx0XHRcdGNhc2UgJ0Y0QSc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdmNGEnLCBtaW1lOiAnYXVkaW8vbXA0J307XG5cdFx0XHRcdGNhc2UgJ0Y0Qic6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdmNGInLCBtaW1lOiAnYXVkaW8vbXA0J307XG5cdFx0XHRcdGNhc2UgJ2NyeCc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdjcjMnLCBtaW1lOiAnaW1hZ2UveC1jYW5vbi1jcjMnfTtcblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRpZiAoYnJhbmRNYWpvci5zdGFydHNXaXRoKCczZycpKSB7XG5cdFx0XHRcdFx0XHRpZiAoYnJhbmRNYWpvci5zdGFydHNXaXRoKCczZzInKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJzNnMicsIG1pbWU6ICd2aWRlby8zZ3BwMid9O1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJzNncCcsIG1pbWU6ICd2aWRlby8zZ3BwJ307XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdtcDQnLCBtaW1lOiAndmlkZW8vbXA0J307XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ01UaGQnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbWlkJyxcblx0XHRcdFx0bWltZTogJ2F1ZGlvL21pZGknLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoXG5cdFx0XHR0aGlzLmNoZWNrU3RyaW5nKCd3T0ZGJylcblx0XHRcdCYmIChcblx0XHRcdFx0dGhpcy5jaGVjayhbMHgwMCwgMHgwMSwgMHgwMCwgMHgwMF0sIHtvZmZzZXQ6IDR9KVxuXHRcdFx0XHR8fCB0aGlzLmNoZWNrU3RyaW5nKCdPVFRPJywge29mZnNldDogNH0pXG5cdFx0XHQpXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd3b2ZmJyxcblx0XHRcdFx0bWltZTogJ2ZvbnQvd29mZicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdHRoaXMuY2hlY2tTdHJpbmcoJ3dPRjInKVxuXHRcdFx0JiYgKFxuXHRcdFx0XHR0aGlzLmNoZWNrKFsweDAwLCAweDAxLCAweDAwLCAweDAwXSwge29mZnNldDogNH0pXG5cdFx0XHRcdHx8IHRoaXMuY2hlY2tTdHJpbmcoJ09UVE8nLCB7b2Zmc2V0OiA0fSlcblx0XHRcdClcblx0XHQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3dvZmYyJyxcblx0XHRcdFx0bWltZTogJ2ZvbnQvd29mZjInLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhENCwgMHhDMywgMHhCMiwgMHhBMV0pIHx8IHRoaXMuY2hlY2soWzB4QTEsIDB4QjIsIDB4QzMsIDB4RDRdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAncGNhcCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQudGNwZHVtcC5wY2FwJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gU29ueSBEU0QgU3RyZWFtIEZpbGUgKERTRilcblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnRFNEICcpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdkc2YnLFxuXHRcdFx0XHRtaW1lOiAnYXVkaW8veC1kc2YnLCAvLyBOb24tc3RhbmRhcmRcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0xaSVAnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbHonLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1semlwJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ2ZMYUMnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZmxhYycsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby94LWZsYWMnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0MiwgMHg1MCwgMHg0NywgMHhGQl0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdicGcnLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2UvYnBnJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ3d2cGsnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnd3YnLFxuXHRcdFx0XHRtaW1lOiAnYXVkaW8vd2F2cGFjaycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCclUERGJykpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUoMTM1MCk7XG5cdFx0XHRcdGNvbnN0IG1heEJ1ZmZlclNpemUgPSAxMCAqIDEwMjQgKiAxMDI0O1xuXHRcdFx0XHRjb25zdCBidWZmZXIgPSBCdWZmZXIuYWxsb2MoTWF0aC5taW4obWF4QnVmZmVyU2l6ZSwgdG9rZW5pemVyLmZpbGVJbmZvLnNpemUpKTtcblx0XHRcdFx0YXdhaXQgdG9rZW5pemVyLnJlYWRCdWZmZXIoYnVmZmVyLCB7bWF5QmVMZXNzOiB0cnVlfSk7XG5cblx0XHRcdFx0Ly8gQ2hlY2sgaWYgdGhpcyBpcyBhbiBBZG9iZSBJbGx1c3RyYXRvciBmaWxlXG5cdFx0XHRcdGlmIChidWZmZXIuaW5jbHVkZXMoQnVmZmVyLmZyb20oJ0FJUHJpdmF0ZURhdGEnKSkpIHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZXh0OiAnYWknLFxuXHRcdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3Bvc3RzY3JpcHQnLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdC8vIFN3YWxsb3cgZW5kIG9mIHN0cmVhbSBlcnJvciBpZiBmaWxlIGlzIHRvbyBzbWFsbCBmb3IgdGhlIEFkb2JlIEFJIGNoZWNrXG5cdFx0XHRcdGlmICghKGVycm9yIGluc3RhbmNlb2Ygc3RydG9rMy5FbmRPZlN0cmVhbUVycm9yKSkge1xuXHRcdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEFzc3VtZSB0aGlzIGlzIGp1c3QgYSBub3JtYWwgUERGXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdwZGYnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vcGRmJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MDAsIDB4NjEsIDB4NzMsIDB4NkRdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnd2FzbScsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi93YXNtJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gVElGRiwgbGl0dGxlLWVuZGlhbiB0eXBlXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NDksIDB4NDldKSkge1xuXHRcdFx0Y29uc3QgZmlsZVR5cGUgPSBhd2FpdCB0aGlzLnJlYWRUaWZmSGVhZGVyKGZhbHNlKTtcblx0XHRcdGlmIChmaWxlVHlwZSkge1xuXHRcdFx0XHRyZXR1cm4gZmlsZVR5cGU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gVElGRiwgYmlnLWVuZGlhbiB0eXBlXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NEQsIDB4NERdKSkge1xuXHRcdFx0Y29uc3QgZmlsZVR5cGUgPSBhd2FpdCB0aGlzLnJlYWRUaWZmSGVhZGVyKHRydWUpO1xuXHRcdFx0aWYgKGZpbGVUeXBlKSB7XG5cdFx0XHRcdHJldHVybiBmaWxlVHlwZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnTUFDICcpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdhcGUnLFxuXHRcdFx0XHRtaW1lOiAnYXVkaW8vYXBlJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL2ZpbGUvZmlsZS9ibG9iL21hc3Rlci9tYWdpYy9NYWdkaXIvbWF0cm9za2Fcblx0XHRpZiAodGhpcy5jaGVjayhbMHgxQSwgMHg0NSwgMHhERiwgMHhBM10pKSB7IC8vIFJvb3QgZWxlbWVudDogRUJNTFxuXHRcdFx0YXN5bmMgZnVuY3Rpb24gcmVhZEZpZWxkKCkge1xuXHRcdFx0XHRjb25zdCBtc2IgPSBhd2FpdCB0b2tlbml6ZXIucGVla051bWJlcihUb2tlbi5VSU5UOCk7XG5cdFx0XHRcdGxldCBtYXNrID0gMHg4MDtcblx0XHRcdFx0bGV0IGljID0gMDsgLy8gMCA9IEEsIDEgPSBCLCAyID0gQywgM1xuXHRcdFx0XHQvLyA9IERcblxuXHRcdFx0XHR3aGlsZSAoKG1zYiAmIG1hc2spID09PSAwICYmIG1hc2sgIT09IDApIHtcblx0XHRcdFx0XHQrK2ljO1xuXHRcdFx0XHRcdG1hc2sgPj49IDE7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBpZCA9IEJ1ZmZlci5hbGxvYyhpYyArIDEpO1xuXHRcdFx0XHRhd2FpdCB0b2tlbml6ZXIucmVhZEJ1ZmZlcihpZCk7XG5cdFx0XHRcdHJldHVybiBpZDtcblx0XHRcdH1cblxuXHRcdFx0YXN5bmMgZnVuY3Rpb24gcmVhZEVsZW1lbnQoKSB7XG5cdFx0XHRcdGNvbnN0IGlkID0gYXdhaXQgcmVhZEZpZWxkKCk7XG5cdFx0XHRcdGNvbnN0IGxlbmd0aEZpZWxkID0gYXdhaXQgcmVhZEZpZWxkKCk7XG5cdFx0XHRcdGxlbmd0aEZpZWxkWzBdIF49IDB4ODAgPj4gKGxlbmd0aEZpZWxkLmxlbmd0aCAtIDEpO1xuXHRcdFx0XHRjb25zdCBuckxlbmd0aCA9IE1hdGgubWluKDYsIGxlbmd0aEZpZWxkLmxlbmd0aCk7IC8vIEphdmFTY3JpcHQgY2FuIG1heCByZWFkIDYgYnl0ZXMgaW50ZWdlclxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGlkOiBpZC5yZWFkVUludEJFKDAsIGlkLmxlbmd0aCksXG5cdFx0XHRcdFx0bGVuOiBsZW5ndGhGaWVsZC5yZWFkVUludEJFKGxlbmd0aEZpZWxkLmxlbmd0aCAtIG5yTGVuZ3RoLCBuckxlbmd0aCksXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGFzeW5jIGZ1bmN0aW9uIHJlYWRDaGlsZHJlbihjaGlsZHJlbikge1xuXHRcdFx0XHR3aGlsZSAoY2hpbGRyZW4gPiAwKSB7XG5cdFx0XHRcdFx0Y29uc3QgZWxlbWVudCA9IGF3YWl0IHJlYWRFbGVtZW50KCk7XG5cdFx0XHRcdFx0aWYgKGVsZW1lbnQuaWQgPT09IDB4NDJfODIpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHJhd1ZhbHVlID0gYXdhaXQgdG9rZW5pemVyLnJlYWRUb2tlbihuZXcgVG9rZW4uU3RyaW5nVHlwZShlbGVtZW50LmxlbiwgJ3V0Zi04JykpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHJhd1ZhbHVlLnJlcGxhY2UoL1xcMDAuKiQvZywgJycpOyAvLyBSZXR1cm4gRG9jVHlwZVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUoZWxlbWVudC5sZW4pOyAvLyBpZ25vcmUgcGF5bG9hZFxuXHRcdFx0XHRcdC0tY2hpbGRyZW47XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmUgPSBhd2FpdCByZWFkRWxlbWVudCgpO1xuXHRcdFx0Y29uc3QgZG9jVHlwZSA9IGF3YWl0IHJlYWRDaGlsZHJlbihyZS5sZW4pO1xuXG5cdFx0XHRzd2l0Y2ggKGRvY1R5cGUpIHtcblx0XHRcdFx0Y2FzZSAnd2VibSc6XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGV4dDogJ3dlYm0nLFxuXHRcdFx0XHRcdFx0bWltZTogJ3ZpZGVvL3dlYm0nLFxuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0Y2FzZSAnbWF0cm9za2EnOlxuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRleHQ6ICdta3YnLFxuXHRcdFx0XHRcdFx0bWltZTogJ3ZpZGVvL3gtbWF0cm9za2EnLFxuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gUklGRiBmaWxlIGZvcm1hdCB3aGljaCBtaWdodCBiZSBBVkksIFdBViwgUUNQLCBldGNcblx0XHRpZiAodGhpcy5jaGVjayhbMHg1MiwgMHg0OSwgMHg0NiwgMHg0Nl0pKSB7XG5cdFx0XHRpZiAodGhpcy5jaGVjayhbMHg0MSwgMHg1NiwgMHg0OV0sIHtvZmZzZXQ6IDh9KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ2F2aScsXG5cdFx0XHRcdFx0bWltZTogJ3ZpZGVvL3ZuZC5hdmknLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5jaGVjayhbMHg1NywgMHg0MSwgMHg1NiwgMHg0NV0sIHtvZmZzZXQ6IDh9KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ3dhdicsXG5cdFx0XHRcdFx0bWltZTogJ2F1ZGlvL3ZuZC53YXZlJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUUxDTSwgUUNQIGZpbGVcblx0XHRcdGlmICh0aGlzLmNoZWNrKFsweDUxLCAweDRDLCAweDQzLCAweDREXSwge29mZnNldDogOH0pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAncWNwJyxcblx0XHRcdFx0XHRtaW1lOiAnYXVkaW8vcWNlbHAnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdTUUxpJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3NxbGl0ZScsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LXNxbGl0ZTMnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0RSwgMHg0NSwgMHg1MywgMHgxQV0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICduZXMnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1uaW50ZW5kby1uZXMtcm9tJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0NyMjQnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnY3J4Jyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtZ29vZ2xlLWNocm9tZS1leHRlbnNpb24nLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoXG5cdFx0XHR0aGlzLmNoZWNrU3RyaW5nKCdNU0NGJylcblx0XHRcdHx8IHRoaXMuY2hlY2tTdHJpbmcoJ0lTYygnKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnY2FiJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5tcy1jYWItY29tcHJlc3NlZCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweEVELCAweEFCLCAweEVFLCAweERCXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3JwbScsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LXJwbScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweEM1LCAweEQwLCAweEQzLCAweEM2XSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2VwcycsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9lcHMnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgyOCwgMHhCNSwgMHgyRiwgMHhGRF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd6c3QnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24venN0ZCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDdGLCAweDQ1LCAweDRDLCAweDQ2XSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2VsZicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWVsZicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDIxLCAweDQyLCAweDQ0LCAweDRFXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3BzdCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQubXMtb3V0bG9vaycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdQQVIxJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3BhcnF1ZXQnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1wYXJxdWV0Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4Q0YsIDB4RkEsIDB4RUQsIDB4RkVdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbWFjaG8nLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1tYWNoLWJpbmFyeScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIC0tIDUtYnl0ZSBzaWduYXR1cmVzIC0tXG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0RiwgMHg1NCwgMHg1NCwgMHg0RiwgMHgwMF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdvdGYnLFxuXHRcdFx0XHRtaW1lOiAnZm9udC9vdGYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnIyFBTVInKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnYW1yJyxcblx0XHRcdFx0bWltZTogJ2F1ZGlvL2FtcicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCd7XFxcXHJ0ZicpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdydGYnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vcnRmJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NDYsIDB4NEMsIDB4NTYsIDB4MDFdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZmx2Jyxcblx0XHRcdFx0bWltZTogJ3ZpZGVvL3gtZmx2Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0lNUE0nKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnaXQnLFxuXHRcdFx0XHRtaW1lOiAnYXVkaW8veC1pdCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdHRoaXMuY2hlY2tTdHJpbmcoJy1saDAtJywge29mZnNldDogMn0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrU3RyaW5nKCctbGgxLScsIHtvZmZzZXQ6IDJ9KVxuXHRcdFx0fHwgdGhpcy5jaGVja1N0cmluZygnLWxoMi0nLCB7b2Zmc2V0OiAyfSlcblx0XHRcdHx8IHRoaXMuY2hlY2tTdHJpbmcoJy1saDMtJywge29mZnNldDogMn0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrU3RyaW5nKCctbGg0LScsIHtvZmZzZXQ6IDJ9KVxuXHRcdFx0fHwgdGhpcy5jaGVja1N0cmluZygnLWxoNS0nLCB7b2Zmc2V0OiAyfSlcblx0XHRcdHx8IHRoaXMuY2hlY2tTdHJpbmcoJy1saDYtJywge29mZnNldDogMn0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrU3RyaW5nKCctbGg3LScsIHtvZmZzZXQ6IDJ9KVxuXHRcdFx0fHwgdGhpcy5jaGVja1N0cmluZygnLWx6cy0nLCB7b2Zmc2V0OiAyfSlcblx0XHRcdHx8IHRoaXMuY2hlY2tTdHJpbmcoJy1sejQtJywge29mZnNldDogMn0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrU3RyaW5nKCctbHo1LScsIHtvZmZzZXQ6IDJ9KVxuXHRcdFx0fHwgdGhpcy5jaGVja1N0cmluZygnLWxoZC0nLCB7b2Zmc2V0OiAyfSlcblx0XHQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2x6aCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWx6aC1jb21wcmVzc2VkJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gTVBFRyBwcm9ncmFtIHN0cmVhbSAoUFMgb3IgTVBFRy1QUylcblx0XHRpZiAodGhpcy5jaGVjayhbMHgwMCwgMHgwMCwgMHgwMSwgMHhCQV0pKSB7XG5cdFx0XHQvLyAgTVBFRy1QUywgTVBFRy0xIFBhcnQgMVxuXHRcdFx0aWYgKHRoaXMuY2hlY2soWzB4MjFdLCB7b2Zmc2V0OiA0LCBtYXNrOiBbMHhGMV19KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ21wZycsIC8vIE1heSBhbHNvIGJlIC5wcywgLm1wZWdcblx0XHRcdFx0XHRtaW1lOiAndmlkZW8vTVAxUycsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdC8vIE1QRUctUFMsIE1QRUctMiBQYXJ0IDFcblx0XHRcdGlmICh0aGlzLmNoZWNrKFsweDQ0XSwge29mZnNldDogNCwgbWFzazogWzB4QzRdfSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdtcGcnLCAvLyBNYXkgYWxzbyBiZSAubXBnLCAubTJwLCAudm9iIG9yIC5zdWJcblx0XHRcdFx0XHRtaW1lOiAndmlkZW8vTVAyUCcsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0lUU0YnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnY2htJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5tcy1odG1saGVscCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweENBLCAweEZFLCAweEJBLCAweEJFXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2NsYXNzJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL2phdmEtdm0nLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyAtLSA2LWJ5dGUgc2lnbmF0dXJlcyAtLVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4RkQsIDB4MzcsIDB4N0EsIDB4NTgsIDB4NUEsIDB4MDBdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAneHonLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC14eicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCc8P3htbCAnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAneG1sJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3htbCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDM3LCAweDdBLCAweEJDLCAweEFGLCAweDI3LCAweDFDXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJzd6Jyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtN3otY29tcHJlc3NlZCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdHRoaXMuY2hlY2soWzB4NTIsIDB4NjEsIDB4NzIsIDB4MjEsIDB4MUEsIDB4N10pXG5cdFx0XHQmJiAodGhpcy5idWZmZXJbNl0gPT09IDB4MCB8fCB0aGlzLmJ1ZmZlcls2XSA9PT0gMHgxKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAncmFyJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtcmFyLWNvbXByZXNzZWQnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnc29saWQgJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3N0bCcsXG5cdFx0XHRcdG1pbWU6ICdtb2RlbC9zdGwnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnQUMnKSkge1xuXHRcdFx0Y29uc3QgdmVyc2lvbiA9IHRoaXMuYnVmZmVyLnRvU3RyaW5nKCdiaW5hcnknLCAyLCA2KTtcblx0XHRcdGlmICh2ZXJzaW9uLm1hdGNoKCdeZConKSAmJiB2ZXJzaW9uID49IDEwMDAgJiYgdmVyc2lvbiA8PSAxMDUwKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnZHdnJyxcblx0XHRcdFx0XHRtaW1lOiAnaW1hZ2Uvdm5kLmR3ZycsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJzA3MDcwNycpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdjcGlvJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtY3BpbycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIC0tIDctYnl0ZSBzaWduYXR1cmVzIC0tXG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnQkxFTkRFUicpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdibGVuZCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWJsZW5kZXInLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnITxhcmNoPicpKSB7XG5cdFx0XHRhd2FpdCB0b2tlbml6ZXIuaWdub3JlKDgpO1xuXHRcdFx0Y29uc3Qgc3RyaW5nID0gYXdhaXQgdG9rZW5pemVyLnJlYWRUb2tlbihuZXcgVG9rZW4uU3RyaW5nVHlwZSgxMywgJ2FzY2lpJykpO1xuXHRcdFx0aWYgKHN0cmluZyA9PT0gJ2RlYmlhbi1iaW5hcnknKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnZGViJyxcblx0XHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1kZWInLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdhcicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LXVuaXgtYXJjaGl2ZScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCcqKkFDRScsIHtvZmZzZXQ6IDd9KSkge1xuXHRcdFx0YXdhaXQgdG9rZW5pemVyLnBlZWtCdWZmZXIodGhpcy5idWZmZXIsIHtsZW5ndGg6IDE0LCBtYXlCZUxlc3M6IHRydWV9KTtcblx0XHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCcqKicsIHtvZmZzZXQ6IDEyfSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdhY2UnLFxuXHRcdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWFjZS1jb21wcmVzc2VkJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyAtLSA4LWJ5dGUgc2lnbmF0dXJlcyAtLVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4ODksIDB4NTAsIDB4NEUsIDB4NDcsIDB4MEQsIDB4MEEsIDB4MUEsIDB4MEFdKSkge1xuXHRcdFx0Ly8gQVBORyBmb3JtYXQgKGh0dHBzOi8vd2lraS5tb3ppbGxhLm9yZy9BUE5HX1NwZWNpZmljYXRpb24pXG5cdFx0XHQvLyAxLiBGaW5kIHRoZSBmaXJzdCBJREFUIChpbWFnZSBkYXRhKSBjaHVuayAoNDkgNDQgNDEgNTQpXG5cdFx0XHQvLyAyLiBDaGVjayBpZiB0aGVyZSBpcyBhbiBcImFjVExcIiBjaHVuayBiZWZvcmUgdGhlIElEQVQgb25lICg2MSA2MyA1NCA0QylcblxuXHRcdFx0Ly8gT2Zmc2V0IGNhbGN1bGF0ZWQgYXMgZm9sbG93czpcblx0XHRcdC8vIC0gOCBieXRlczogUE5HIHNpZ25hdHVyZVxuXHRcdFx0Ly8gLSA0IChsZW5ndGgpICsgNCAoY2h1bmsgdHlwZSkgKyAxMyAoY2h1bmsgZGF0YSkgKyA0IChDUkMpOiBJSERSIGNodW5rXG5cblx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUoOCk7IC8vIGlnbm9yZSBQTkcgc2lnbmF0dXJlXG5cblx0XHRcdGFzeW5jIGZ1bmN0aW9uIHJlYWRDaHVua0hlYWRlcigpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRsZW5ndGg6IGF3YWl0IHRva2VuaXplci5yZWFkVG9rZW4oVG9rZW4uSU5UMzJfQkUpLFxuXHRcdFx0XHRcdHR5cGU6IGF3YWl0IHRva2VuaXplci5yZWFkVG9rZW4obmV3IFRva2VuLlN0cmluZ1R5cGUoNCwgJ2JpbmFyeScpKSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0ZG8ge1xuXHRcdFx0XHRjb25zdCBjaHVuayA9IGF3YWl0IHJlYWRDaHVua0hlYWRlcigpO1xuXHRcdFx0XHRpZiAoY2h1bmsubGVuZ3RoIDwgMCkge1xuXHRcdFx0XHRcdHJldHVybjsgLy8gSW52YWxpZCBjaHVuayBsZW5ndGhcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHN3aXRjaCAoY2h1bmsudHlwZSkge1xuXHRcdFx0XHRcdGNhc2UgJ0lEQVQnOlxuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0ZXh0OiAncG5nJyxcblx0XHRcdFx0XHRcdFx0bWltZTogJ2ltYWdlL3BuZycsXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdGNhc2UgJ2FjVEwnOlxuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0ZXh0OiAnYXBuZycsXG5cdFx0XHRcdFx0XHRcdG1pbWU6ICdpbWFnZS9hcG5nJyxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUoY2h1bmsubGVuZ3RoICsgNCk7IC8vIElnbm9yZSBjaHVuay1kYXRhICsgQ1JDXG5cdFx0XHRcdH1cblx0XHRcdH0gd2hpbGUgKHRva2VuaXplci5wb3NpdGlvbiArIDggPCB0b2tlbml6ZXIuZmlsZUluZm8uc2l6ZSk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3BuZycsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS9wbmcnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0MSwgMHg1MiwgMHg1MiwgMHg0RiwgMHg1NywgMHgzMSwgMHgwMCwgMHgwMF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdhcnJvdycsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWFwYWNoZS1hcnJvdycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDY3LCAweDZDLCAweDU0LCAweDQ2LCAweDAyLCAweDAwLCAweDAwLCAweDAwXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2dsYicsXG5cdFx0XHRcdG1pbWU6ICdtb2RlbC9nbHRmLWJpbmFyeScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIGBtb3ZgIGZvcm1hdCB2YXJpYW50c1xuXHRcdGlmIChcblx0XHRcdHRoaXMuY2hlY2soWzB4NjYsIDB4NzIsIDB4NjUsIDB4NjVdLCB7b2Zmc2V0OiA0fSkgLy8gYGZyZWVgXG5cdFx0XHR8fCB0aGlzLmNoZWNrKFsweDZELCAweDY0LCAweDYxLCAweDc0XSwge29mZnNldDogNH0pIC8vIGBtZGF0YCBNSlBFR1xuXHRcdFx0fHwgdGhpcy5jaGVjayhbMHg2RCwgMHg2RiwgMHg2RiwgMHg3Nl0sIHtvZmZzZXQ6IDR9KSAvLyBgbW9vdmBcblx0XHRcdHx8IHRoaXMuY2hlY2soWzB4NzcsIDB4NjksIDB4NjQsIDB4NjVdLCB7b2Zmc2V0OiA0fSkgLy8gYHdpZGVgXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdtb3YnLFxuXHRcdFx0XHRtaW1lOiAndmlkZW8vcXVpY2t0aW1lJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gLS0gOS1ieXRlIHNpZ25hdHVyZXMgLS1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDQ5LCAweDQ5LCAweDUyLCAweDRGLCAweDA4LCAweDAwLCAweDAwLCAweDAwLCAweDE4XSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ29yZicsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS94LW9seW1wdXMtb3JmJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ2dpbXAgeGNmICcpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd4Y2YnLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2UveC14Y2YnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyAtLSAxMi1ieXRlIHNpZ25hdHVyZXMgLS1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDQ5LCAweDQ5LCAweDU1LCAweDAwLCAweDE4LCAweDAwLCAweDAwLCAweDAwLCAweDg4LCAweEU3LCAweDc0LCAweEQ4XSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3J3MicsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS94LXBhbmFzb25pYy1ydzInLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBBU0ZfSGVhZGVyX09iamVjdCBmaXJzdCA4MCBieXRlc1xuXHRcdGlmICh0aGlzLmNoZWNrKFsweDMwLCAweDI2LCAweEIyLCAweDc1LCAweDhFLCAweDY2LCAweENGLCAweDExLCAweEE2LCAweEQ5XSkpIHtcblx0XHRcdGFzeW5jIGZ1bmN0aW9uIHJlYWRIZWFkZXIoKSB7XG5cdFx0XHRcdGNvbnN0IGd1aWQgPSBCdWZmZXIuYWxsb2MoMTYpO1xuXHRcdFx0XHRhd2FpdCB0b2tlbml6ZXIucmVhZEJ1ZmZlcihndWlkKTtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRpZDogZ3VpZCxcblx0XHRcdFx0XHRzaXplOiBOdW1iZXIoYXdhaXQgdG9rZW5pemVyLnJlYWRUb2tlbihUb2tlbi5VSU5UNjRfTEUpKSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0YXdhaXQgdG9rZW5pemVyLmlnbm9yZSgzMCk7XG5cdFx0XHQvLyBTZWFyY2ggZm9yIGhlYWRlciBzaG91bGQgYmUgaW4gZmlyc3QgMUtCIG9mIGZpbGUuXG5cdFx0XHR3aGlsZSAodG9rZW5pemVyLnBvc2l0aW9uICsgMjQgPCB0b2tlbml6ZXIuZmlsZUluZm8uc2l6ZSkge1xuXHRcdFx0XHRjb25zdCBoZWFkZXIgPSBhd2FpdCByZWFkSGVhZGVyKCk7XG5cdFx0XHRcdGxldCBwYXlsb2FkID0gaGVhZGVyLnNpemUgLSAyNDtcblx0XHRcdFx0aWYgKF9jaGVjayhoZWFkZXIuaWQsIFsweDkxLCAweDA3LCAweERDLCAweEI3LCAweEI3LCAweEE5LCAweENGLCAweDExLCAweDhFLCAweEU2LCAweDAwLCAweEMwLCAweDBDLCAweDIwLCAweDUzLCAweDY1XSkpIHtcblx0XHRcdFx0XHQvLyBTeW5jIG9uIFN0cmVhbS1Qcm9wZXJ0aWVzLU9iamVjdCAoQjdEQzA3OTEtQTlCNy0xMUNGLThFRTYtMDBDMDBDMjA1MzY1KVxuXHRcdFx0XHRcdGNvbnN0IHR5cGVJZCA9IEJ1ZmZlci5hbGxvYygxNik7XG5cdFx0XHRcdFx0cGF5bG9hZCAtPSBhd2FpdCB0b2tlbml6ZXIucmVhZEJ1ZmZlcih0eXBlSWQpO1xuXG5cdFx0XHRcdFx0aWYgKF9jaGVjayh0eXBlSWQsIFsweDQwLCAweDlFLCAweDY5LCAweEY4LCAweDRELCAweDVCLCAweENGLCAweDExLCAweEE4LCAweEZELCAweDAwLCAweDgwLCAweDVGLCAweDVDLCAweDQ0LCAweDJCXSkpIHtcblx0XHRcdFx0XHRcdC8vIEZvdW5kIGF1ZGlvOlxuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0ZXh0OiAnYXNmJyxcblx0XHRcdFx0XHRcdFx0bWltZTogJ2F1ZGlvL3gtbXMtYXNmJyxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKF9jaGVjayh0eXBlSWQsIFsweEMwLCAweEVGLCAweDE5LCAweEJDLCAweDRELCAweDVCLCAweENGLCAweDExLCAweEE4LCAweEZELCAweDAwLCAweDgwLCAweDVGLCAweDVDLCAweDQ0LCAweDJCXSkpIHtcblx0XHRcdFx0XHRcdC8vIEZvdW5kIHZpZGVvOlxuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0ZXh0OiAnYXNmJyxcblx0XHRcdFx0XHRcdFx0bWltZTogJ3ZpZGVvL3gtbXMtYXNmJyxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRhd2FpdCB0b2tlbml6ZXIuaWdub3JlKHBheWxvYWQpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBEZWZhdWx0IHRvIEFTRiBnZW5lcmljIGV4dGVuc2lvblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnYXNmJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5tcy1hc2YnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhBQiwgMHg0QiwgMHg1NCwgMHg1OCwgMHgyMCwgMHgzMSwgMHgzMSwgMHhCQiwgMHgwRCwgMHgwQSwgMHgxQSwgMHgwQV0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdrdHgnLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2Uva3R4Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKCh0aGlzLmNoZWNrKFsweDdFLCAweDEwLCAweDA0XSkgfHwgdGhpcy5jaGVjayhbMHg3RSwgMHgxOCwgMHgwNF0pKSAmJiB0aGlzLmNoZWNrKFsweDMwLCAweDRELCAweDQ5LCAweDQ1XSwge29mZnNldDogNH0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdtaWUnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1taWUnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgyNywgMHgwQSwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMF0sIHtvZmZzZXQ6IDJ9KSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnc2hwJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtZXNyaS1zaGFwZScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweEZGLCAweDRGLCAweEZGLCAweDUxXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2oyYycsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS9qMmMnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgwMCwgMHgwMCwgMHgwMCwgMHgwQywgMHg2QSwgMHg1MCwgMHgyMCwgMHgyMCwgMHgwRCwgMHgwQSwgMHg4NywgMHgwQV0pKSB7XG5cdFx0XHQvLyBKUEVHLTIwMDAgZmFtaWx5XG5cblx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUoMjApO1xuXHRcdFx0Y29uc3QgdHlwZSA9IGF3YWl0IHRva2VuaXplci5yZWFkVG9rZW4obmV3IFRva2VuLlN0cmluZ1R5cGUoNCwgJ2FzY2lpJykpO1xuXHRcdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRcdGNhc2UgJ2pwMiAnOlxuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRleHQ6ICdqcDInLFxuXHRcdFx0XHRcdFx0bWltZTogJ2ltYWdlL2pwMicsXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0Y2FzZSAnanB4ICc6XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGV4dDogJ2pweCcsXG5cdFx0XHRcdFx0XHRtaW1lOiAnaW1hZ2UvanB4Jyxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRjYXNlICdqcG0gJzpcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZXh0OiAnanBtJyxcblx0XHRcdFx0XHRcdG1pbWU6ICdpbWFnZS9qcG0nLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdGNhc2UgJ21qcDInOlxuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRleHQ6ICdtajInLFxuXHRcdFx0XHRcdFx0bWltZTogJ2ltYWdlL21qMicsXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5jaGVjayhbMHhGRiwgMHgwQV0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrKFsweDAwLCAweDAwLCAweDAwLCAweDBDLCAweDRBLCAweDU4LCAweDRDLCAweDIwLCAweDBELCAweDBBLCAweDg3LCAweDBBXSlcblx0XHQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2p4bCcsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS9qeGwnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhGRSwgMHhGRl0pKSB7IC8vIFVURi0xNi1CT00tTEVcblx0XHRcdGlmICh0aGlzLmNoZWNrKFswLCA2MCwgMCwgNjMsIDAsIDEyMCwgMCwgMTA5LCAwLCAxMDhdLCB7b2Zmc2V0OiAyfSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICd4bWwnLFxuXHRcdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94bWwnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkOyAvLyBTb21lIHVua25vd24gdGV4dCBiYXNlZCBmb3JtYXRcblx0XHR9XG5cblx0XHQvLyAtLSBVbnNhZmUgc2lnbmF0dXJlcyAtLVxuXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5jaGVjayhbMHgwLCAweDAsIDB4MSwgMHhCQV0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrKFsweDAsIDB4MCwgMHgxLCAweEIzXSlcblx0XHQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ21wZycsXG5cdFx0XHRcdG1pbWU6ICd2aWRlby9tcGVnJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsIDB4MDBdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAndHRmJyxcblx0XHRcdFx0bWltZTogJ2ZvbnQvdHRmJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MDAsIDB4MDAsIDB4MDEsIDB4MDBdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnaWNvJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL3gtaWNvbicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDAwLCAweDAwLCAweDAyLCAweDAwXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2N1cicsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS94LWljb24nLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhEMCwgMHhDRiwgMHgxMSwgMHhFMCwgMHhBMSwgMHhCMSwgMHgxQSwgMHhFMV0pKSB7XG5cdFx0XHQvLyBEZXRlY3RlZCBNaWNyb3NvZnQgQ29tcG91bmQgRmlsZSBCaW5hcnkgRmlsZSAoTVMtQ0ZCKSBGb3JtYXQuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdjZmInLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1jZmInLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBJbmNyZWFzZSBzYW1wbGUgc2l6ZSBmcm9tIDEyIHRvIDI1Ni5cblx0XHRhd2FpdCB0b2tlbml6ZXIucGVla0J1ZmZlcih0aGlzLmJ1ZmZlciwge2xlbmd0aDogTWF0aC5taW4oMjU2LCB0b2tlbml6ZXIuZmlsZUluZm8uc2l6ZSksIG1heUJlTGVzczogdHJ1ZX0pO1xuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NjEsIDB4NjMsIDB4NzMsIDB4NzBdLCB7b2Zmc2V0OiAzNn0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdpY2MnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vdm5kLmljY3Byb2ZpbGUnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyAtLSAxNS1ieXRlIHNpZ25hdHVyZXMgLS1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdCRUdJTjonKSkge1xuXHRcdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ1ZDQVJEJywge29mZnNldDogNn0pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAndmNmJyxcblx0XHRcdFx0XHRtaW1lOiAndGV4dC92Y2FyZCcsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdWQ0FMRU5EQVInLCB7b2Zmc2V0OiA2fSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdpY3MnLFxuXHRcdFx0XHRcdG1pbWU6ICd0ZXh0L2NhbGVuZGFyJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBgcmFmYCBpcyBoZXJlIGp1c3QgdG8ga2VlcCBhbGwgdGhlIHJhdyBpbWFnZSBkZXRlY3RvcnMgdG9nZXRoZXIuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0ZVSklGSUxNQ0NELVJBVycpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdyYWYnLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2UveC1mdWppZmlsbS1yYWYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnRXh0ZW5kZWQgTW9kdWxlOicpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd4bScsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby94LXhtJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0NyZWF0aXZlIFZvaWNlIEZpbGUnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAndm9jJyxcblx0XHRcdFx0bWltZTogJ2F1ZGlvL3gtdm9jJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MDQsIDB4MDAsIDB4MDAsIDB4MDBdKSAmJiB0aGlzLmJ1ZmZlci5sZW5ndGggPj0gMTYpIHsgLy8gUm91Z2ggJiBxdWljayBjaGVjayBQaWNrbGUvQVNBUlxuXHRcdFx0Y29uc3QganNvblNpemUgPSB0aGlzLmJ1ZmZlci5yZWFkVUludDMyTEUoMTIpO1xuXHRcdFx0aWYgKGpzb25TaXplID4gMTIgJiYgdGhpcy5idWZmZXIubGVuZ3RoID49IGpzb25TaXplICsgMTYpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCBoZWFkZXIgPSB0aGlzLmJ1ZmZlci5zbGljZSgxNiwganNvblNpemUgKyAxNikudG9TdHJpbmcoKTtcblx0XHRcdFx0XHRjb25zdCBqc29uID0gSlNPTi5wYXJzZShoZWFkZXIpO1xuXHRcdFx0XHRcdC8vIENoZWNrIGlmIFBpY2tsZSBpcyBBU0FSXG5cdFx0XHRcdFx0aWYgKGpzb24uZmlsZXMpIHsgLy8gRmluYWwgY2hlY2ssIGFzc3VyaW5nIFBpY2tsZS9BU0FSIGZvcm1hdFxuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0ZXh0OiAnYXNhcicsXG5cdFx0XHRcdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWFzYXInLFxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2gge31cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgwNiwgMHgwRSwgMHgyQiwgMHgzNCwgMHgwMiwgMHgwNSwgMHgwMSwgMHgwMSwgMHgwRCwgMHgwMSwgMHgwMiwgMHgwMSwgMHgwMSwgMHgwMl0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdteGYnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vbXhmJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ1NDUk0nLCB7b2Zmc2V0OiA0NH0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdzM20nLFxuXHRcdFx0XHRtaW1lOiAnYXVkaW8veC1zM20nLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBSYXcgTVBFRy0yIHRyYW5zcG9ydCBzdHJlYW0gKDE4OC1ieXRlIHBhY2tldHMpXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NDddKSAmJiB0aGlzLmNoZWNrKFsweDQ3XSwge29mZnNldDogMTg4fSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ210cycsXG5cdFx0XHRcdG1pbWU6ICd2aWRlby9tcDJ0Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gQmx1LXJheSBEaXNjIEF1ZGlvLVZpZGVvIChCREFWKSBNUEVHLTIgdHJhbnNwb3J0IHN0cmVhbSBoYXMgNC1ieXRlIFRQX2V4dHJhX2hlYWRlciBiZWZvcmUgZWFjaCAxODgtYnl0ZSBwYWNrZXRcblx0XHRpZiAodGhpcy5jaGVjayhbMHg0N10sIHtvZmZzZXQ6IDR9KSAmJiB0aGlzLmNoZWNrKFsweDQ3XSwge29mZnNldDogMTk2fSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ210cycsXG5cdFx0XHRcdG1pbWU6ICd2aWRlby9tcDJ0Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NDIsIDB4NEYsIDB4NEYsIDB4NEIsIDB4NEQsIDB4NEYsIDB4NDIsIDB4NDldLCB7b2Zmc2V0OiA2MH0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdtb2JpJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtbW9iaXBvY2tldC1lYm9vaycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDQ0LCAweDQ5LCAweDQzLCAweDREXSwge29mZnNldDogMTI4fSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2RjbScsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9kaWNvbScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDRDLCAweDAwLCAweDAwLCAweDAwLCAweDAxLCAweDE0LCAweDAyLCAweDAwLCAweDAwLCAweDAwLCAweDAwLCAweDAwLCAweEMwLCAweDAwLCAweDAwLCAweDAwLCAweDAwLCAweDAwLCAweDAwLCAweDQ2XSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2xuaycsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94Lm1zLnNob3J0Y3V0JywgLy8gSW52ZW50ZWQgYnkgdXNcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NjIsIDB4NkYsIDB4NkYsIDB4NkIsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIDB4NkQsIDB4NjEsIDB4NzIsIDB4NkIsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDBdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnYWxpYXMnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC5hcHBsZS5hbGlhcycsIC8vIEludmVudGVkIGJ5IHVzXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdLYXlkYXJhIEZCWCBCaW5hcnkgIFxcdTAwMDAnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZmJ4Jyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3guYXV0b2Rlc2suZmJ4JywgLy8gSW52ZW50ZWQgYnkgdXNcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5jaGVjayhbMHg0QywgMHg1MF0sIHtvZmZzZXQ6IDM0fSlcblx0XHRcdCYmIChcblx0XHRcdFx0dGhpcy5jaGVjayhbMHgwMCwgMHgwMCwgMHgwMV0sIHtvZmZzZXQ6IDh9KVxuXHRcdFx0XHR8fCB0aGlzLmNoZWNrKFsweDAxLCAweDAwLCAweDAyXSwge29mZnNldDogOH0pXG5cdFx0XHRcdHx8IHRoaXMuY2hlY2soWzB4MDIsIDB4MDAsIDB4MDJdLCB7b2Zmc2V0OiA4fSlcblx0XHRcdClcblx0XHQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2VvdCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQubXMtZm9udG9iamVjdCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDA2LCAweDA2LCAweEVELCAweEY1LCAweEQ4LCAweDFELCAweDQ2LCAweEU1LCAweEJELCAweDMxLCAweEVGLCAweEU3LCAweEZFLCAweDc0LCAweEI3LCAweDFEXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2luZGQnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1pbmRlc2lnbicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIEluY3JlYXNlIHNhbXBsZSBzaXplIGZyb20gMjU2IHRvIDUxMlxuXHRcdGF3YWl0IHRva2VuaXplci5wZWVrQnVmZmVyKHRoaXMuYnVmZmVyLCB7bGVuZ3RoOiBNYXRoLm1pbig1MTIsIHRva2VuaXplci5maWxlSW5mby5zaXplKSwgbWF5QmVMZXNzOiB0cnVlfSk7XG5cblx0XHQvLyBSZXF1aXJlcyBhIGJ1ZmZlciBzaXplIG9mIDUxMiBieXRlc1xuXHRcdGlmICh0YXJIZWFkZXJDaGVja3N1bU1hdGNoZXModGhpcy5idWZmZXIpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd0YXInLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC10YXInLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhGRiwgMHhGRV0pKSB7IC8vIFVURi0xNi1CT00tQkVcblx0XHRcdGlmICh0aGlzLmNoZWNrKFs2MCwgMCwgNjMsIDAsIDEyMCwgMCwgMTA5LCAwLCAxMDgsIDBdLCB7b2Zmc2V0OiAyfSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICd4bWwnLFxuXHRcdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94bWwnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5jaGVjayhbMHhGRiwgMHgwRSwgMHg1MywgMHgwMCwgMHg2QiwgMHgwMCwgMHg2NSwgMHgwMCwgMHg3NCwgMHgwMCwgMHg2MywgMHgwMCwgMHg2OCwgMHgwMCwgMHg1NSwgMHgwMCwgMHg3MCwgMHgwMCwgMHgyMCwgMHgwMCwgMHg0RCwgMHgwMCwgMHg2RiwgMHgwMCwgMHg2NCwgMHgwMCwgMHg2NSwgMHgwMCwgMHg2QywgMHgwMF0sIHtvZmZzZXQ6IDJ9KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ3NrcCcsXG5cdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5za2V0Y2h1cC5za3AnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkOyAvLyBTb21lIHRleHQgYmFzZWQgZm9ybWF0XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJy0tLS0tQkVHSU4gUEdQIE1FU1NBR0UtLS0tLScpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdwZ3AnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vcGdwLWVuY3J5cHRlZCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIENoZWNrIE1QRUcgMSBvciAyIExheWVyIDMgaGVhZGVyLCBvciAnbGF5ZXIgMCcgZm9yIEFEVFMgKE1QRUcgc3luYy13b3JkIDB4RkZFKVxuXHRcdGlmICh0aGlzLmJ1ZmZlci5sZW5ndGggPj0gMiAmJiB0aGlzLmNoZWNrKFsweEZGLCAweEUwXSwge29mZnNldDogMCwgbWFzazogWzB4RkYsIDB4RTBdfSkpIHtcblx0XHRcdGlmICh0aGlzLmNoZWNrKFsweDEwXSwge29mZnNldDogMSwgbWFzazogWzB4MTZdfSkpIHtcblx0XHRcdFx0Ly8gQ2hlY2sgZm9yIChBRFRTKSBNUEVHLTJcblx0XHRcdFx0aWYgKHRoaXMuY2hlY2soWzB4MDhdLCB7b2Zmc2V0OiAxLCBtYXNrOiBbMHgwOF19KSkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRleHQ6ICdhYWMnLFxuXHRcdFx0XHRcdFx0bWltZTogJ2F1ZGlvL2FhYycsXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIE11c3QgYmUgKEFEVFMpIE1QRUctNFxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ2FhYycsXG5cdFx0XHRcdFx0bWltZTogJ2F1ZGlvL2FhYycsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdC8vIE1QRUcgMSBvciAyIExheWVyIDMgaGVhZGVyXG5cdFx0XHQvLyBDaGVjayBmb3IgTVBFRyBsYXllciAzXG5cdFx0XHRpZiAodGhpcy5jaGVjayhbMHgwMl0sIHtvZmZzZXQ6IDEsIG1hc2s6IFsweDA2XX0pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnbXAzJyxcblx0XHRcdFx0XHRtaW1lOiAnYXVkaW8vbXBlZycsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdC8vIENoZWNrIGZvciBNUEVHIGxheWVyIDJcblx0XHRcdGlmICh0aGlzLmNoZWNrKFsweDA0XSwge29mZnNldDogMSwgbWFzazogWzB4MDZdfSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdtcDInLFxuXHRcdFx0XHRcdG1pbWU6ICdhdWRpby9tcGVnJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ2hlY2sgZm9yIE1QRUcgbGF5ZXIgMVxuXHRcdFx0aWYgKHRoaXMuY2hlY2soWzB4MDZdLCB7b2Zmc2V0OiAxLCBtYXNrOiBbMHgwNl19KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ21wMScsXG5cdFx0XHRcdFx0bWltZTogJ2F1ZGlvL21wZWcnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHJlYWRUaWZmVGFnKGJpZ0VuZGlhbikge1xuXHRcdGNvbnN0IHRhZ0lkID0gYXdhaXQgdGhpcy50b2tlbml6ZXIucmVhZFRva2VuKGJpZ0VuZGlhbiA/IFRva2VuLlVJTlQxNl9CRSA6IFRva2VuLlVJTlQxNl9MRSk7XG5cdFx0dGhpcy50b2tlbml6ZXIuaWdub3JlKDEwKTtcblx0XHRzd2l0Y2ggKHRhZ0lkKSB7XG5cdFx0XHRjYXNlIDUwXzM0MTpcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdhcncnLFxuXHRcdFx0XHRcdG1pbWU6ICdpbWFnZS94LXNvbnktYXJ3Jyxcblx0XHRcdFx0fTtcblx0XHRcdGNhc2UgNTBfNzA2OlxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ2RuZycsXG5cdFx0XHRcdFx0bWltZTogJ2ltYWdlL3gtYWRvYmUtZG5nJyxcblx0XHRcdFx0fTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcmVhZFRpZmZJRkQoYmlnRW5kaWFuKSB7XG5cdFx0Y29uc3QgbnVtYmVyT2ZUYWdzID0gYXdhaXQgdGhpcy50b2tlbml6ZXIucmVhZFRva2VuKGJpZ0VuZGlhbiA/IFRva2VuLlVJTlQxNl9CRSA6IFRva2VuLlVJTlQxNl9MRSk7XG5cdFx0Zm9yIChsZXQgbiA9IDA7IG4gPCBudW1iZXJPZlRhZ3M7ICsrbikge1xuXHRcdFx0Y29uc3QgZmlsZVR5cGUgPSBhd2FpdCB0aGlzLnJlYWRUaWZmVGFnKGJpZ0VuZGlhbik7XG5cdFx0XHRpZiAoZmlsZVR5cGUpIHtcblx0XHRcdFx0cmV0dXJuIGZpbGVUeXBlO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHJlYWRUaWZmSGVhZGVyKGJpZ0VuZGlhbikge1xuXHRcdGNvbnN0IHZlcnNpb24gPSAoYmlnRW5kaWFuID8gVG9rZW4uVUlOVDE2X0JFIDogVG9rZW4uVUlOVDE2X0xFKS5nZXQodGhpcy5idWZmZXIsIDIpO1xuXHRcdGNvbnN0IGlmZE9mZnNldCA9IChiaWdFbmRpYW4gPyBUb2tlbi5VSU5UMzJfQkUgOiBUb2tlbi5VSU5UMzJfTEUpLmdldCh0aGlzLmJ1ZmZlciwgNCk7XG5cblx0XHRpZiAodmVyc2lvbiA9PT0gNDIpIHtcblx0XHRcdC8vIFRJRkYgZmlsZSBoZWFkZXJcblx0XHRcdGlmIChpZmRPZmZzZXQgPj0gNikge1xuXHRcdFx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnQ1InLCB7b2Zmc2V0OiA4fSkpIHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZXh0OiAnY3IyJyxcblx0XHRcdFx0XHRcdG1pbWU6ICdpbWFnZS94LWNhbm9uLWNyMicsXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChpZmRPZmZzZXQgPj0gOCAmJiAodGhpcy5jaGVjayhbMHgxQywgMHgwMCwgMHhGRSwgMHgwMF0sIHtvZmZzZXQ6IDh9KSB8fCB0aGlzLmNoZWNrKFsweDFGLCAweDAwLCAweDBCLCAweDAwXSwge29mZnNldDogOH0pKSkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRleHQ6ICduZWYnLFxuXHRcdFx0XHRcdFx0bWltZTogJ2ltYWdlL3gtbmlrb24tbmVmJyxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGF3YWl0IHRoaXMudG9rZW5pemVyLmlnbm9yZShpZmRPZmZzZXQpO1xuXHRcdFx0Y29uc3QgZmlsZVR5cGUgPSBhd2FpdCB0aGlzLnJlYWRUaWZmSUZEKGJpZ0VuZGlhbik7XG5cdFx0XHRyZXR1cm4gZmlsZVR5cGUgPz8ge1xuXHRcdFx0XHRleHQ6ICd0aWYnLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2UvdGlmZicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh2ZXJzaW9uID09PSA0Mykge1x0Ly8gQmlnIFRJRkYgZmlsZSBoZWFkZXJcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3RpZicsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS90aWZmJyxcblx0XHRcdH07XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmaWxlVHlwZVN0cmVhbShyZWFkYWJsZVN0cmVhbSwgb3B0aW9ucyA9IHt9KSB7XG5cdHJldHVybiBuZXcgRmlsZVR5cGVQYXJzZXIoKS50b0RldGVjdGlvblN0cmVhbShyZWFkYWJsZVN0cmVhbSwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBjb25zdCBzdXBwb3J0ZWRFeHRlbnNpb25zID0gbmV3IFNldChleHRlbnNpb25zKTtcbmV4cG9ydCBjb25zdCBzdXBwb3J0ZWRNaW1lVHlwZXMgPSBuZXcgU2V0KG1pbWVUeXBlcyk7XG4iLCJpbXBvcnQge2ZpbGVUeXBlRnJvbUJ1ZmZlcn0gZnJvbSAnZmlsZS10eXBlJztcblxuY29uc3QgaW1hZ2VFeHRlbnNpb25zID0gbmV3IFNldChbXG5cdCdqcGcnLFxuXHQncG5nJyxcblx0J2dpZicsXG5cdCd3ZWJwJyxcblx0J2ZsaWYnLFxuXHQnY3IyJyxcblx0J3RpZicsXG5cdCdibXAnLFxuXHQnanhyJyxcblx0J3BzZCcsXG5cdCdpY28nLFxuXHQnYnBnJyxcblx0J2pwMicsXG5cdCdqcG0nLFxuXHQnanB4Jyxcblx0J2hlaWMnLFxuXHQnY3VyJyxcblx0J2RjbScsXG5cdCdhdmlmJyxcbl0pO1xuXG5leHBvcnQgZGVmYXVsdCBhc3luYyBmdW5jdGlvbiBpbWFnZVR5cGUoaW5wdXQpIHtcblx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgZmlsZVR5cGVGcm9tQnVmZmVyKGlucHV0KTtcblx0cmV0dXJuIGltYWdlRXh0ZW5zaW9ucy5oYXMocmVzdWx0Py5leHQpICYmIHJlc3VsdDtcbn1cblxuZXhwb3J0IGNvbnN0IG1pbmltdW1CeXRlcyA9IDQxMDA7XG4iLCIvLyDYp9mE2LnYsdio2YrYqVxuXG5leHBvcnQgZGVmYXVsdCB7fTtcbiIsIi8vIMSNZcWhdGluYVxuXG5leHBvcnQgZGVmYXVsdCB7fTtcbiIsIi8vIERhbnNrXG5cbmV4cG9ydCBkZWZhdWx0IHt9O1xuIiwiLy8gRGV1dHNjaFxuXG5leHBvcnQgZGVmYXVsdCB7fTsiLCIvLyBFbmdsaXNoXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgLy8gc2V0dGluZy50c1xuICBcIlBsdWdpbiBTZXR0aW5nc1wiOiBcIlBsdWdpbiBTZXR0aW5nc1wiLFxuICBcIkF1dG8gcGFzdGVkIHVwbG9hZFwiOiBcIkF1dG8gcGFzdGVkIHVwbG9hZFwiLFxuICBcIklmIHlvdSBzZXQgdGhpcyB2YWx1ZSB0cnVlLCB3aGVuIHlvdSBwYXN0ZSBpbWFnZSwgaXQgd2lsbCBiZSBhdXRvIHVwbG9hZGVkKHlvdSBzaG91bGQgc2V0IHRoZSBwaWNHbyBzZXJ2ZXIgcmlnaHRseSlcIjpcbiAgICBcIklmIHlvdSBzZXQgdGhpcyB2YWx1ZSB0cnVlLCB3aGVuIHlvdSBwYXN0ZSBpbWFnZSwgaXQgd2lsbCBiZSBhdXRvIHVwbG9hZGVkKHlvdSBzaG91bGQgc2V0IHRoZSBwaWNHbyBzZXJ2ZXIgcmlnaHRseSlcIixcbiAgXCJEZWZhdWx0IHVwbG9hZGVyXCI6IFwiRGVmYXVsdCB1cGxvYWRlclwiLFxuICBcIlBpY0dvIHNlcnZlclwiOiBcIlBpY0dvIHNlcnZlciB1cGxvYWQgcm91dGVcIixcbiAgXCJQaWNHbyBzZXJ2ZXIgZGVzY1wiOlxuICAgIFwidXBsb2FkIHJvdXRlLCB1c2UgUGljTGlzdCB3aWxsIGJlIGFibGUgdG8gc2V0IHBpY2JlZCBhbmQgY29uZmlnIHRocm91Z2ggcXVlcnlcIixcbiAgXCJQbGVhc2UgaW5wdXQgUGljR28gc2VydmVyXCI6IFwiUGxlYXNlIGlucHV0IHVwbG9hZCByb3V0ZVwiLFxuICBcIlBpY0dvIGRlbGV0ZSBzZXJ2ZXJcIjpcbiAgICBcIlBpY0dvIHNlcnZlciBkZWxldGUgcm91dGUoeW91IG5lZWQgdG8gdXNlIFBpY0xpc3QgYXBwKVwiLFxuICBcIlBpY0xpc3QgZGVzY1wiOiBcIlNlYXJjaCBQaWNMaXN0IG9uIEdpdGh1YiB0byBkb3dubG9hZCBhbmQgaW5zdGFsbFwiLFxuICBcIlBsZWFzZSBpbnB1dCBQaWNHbyBkZWxldGUgc2VydmVyXCI6IFwiUGxlYXNlIGlucHV0IGRlbGV0ZSBzZXJ2ZXJcIixcbiAgXCJEZWxldGUgaW1hZ2UgdXNpbmcgUGljTGlzdFwiOiBcIkRlbGV0ZSBpbWFnZSB1c2luZyBQaWNMaXN0XCIsXG4gIFwiUGljR28tQ29yZSBwYXRoXCI6IFwiUGljR28tQ29yZSBwYXRoXCIsXG4gIFwiRGVsZXRlIHN1Y2Nlc3NmdWxseVwiOiBcIkRlbGV0ZSBzdWNjZXNzZnVsbHlcIixcbiAgXCJEZWxldGUgZmFpbGVkXCI6IFwiRGVsZXRlIGZhaWxlZFwiLFxuICBcIkltYWdlIHNpemUgc3VmZml4XCI6IFwiSW1hZ2Ugc2l6ZSBzdWZmaXhcIixcbiAgXCJJbWFnZSBzaXplIHN1ZmZpeCBEZXNjcmlwdGlvblwiOiBcImxpa2UgfDMwMCBmb3IgcmVzaXplIGltYWdlIGluIG9iLlwiLFxuICBcIlBsZWFzZSBpbnB1dCBpbWFnZSBzaXplIHN1ZmZpeFwiOiBcIlBsZWFzZSBpbnB1dCBpbWFnZSBzaXplIHN1ZmZpeFwiLFxuICBcIkVycm9yLCBjb3VsZCBub3QgZGVsZXRlXCI6IFwiRXJyb3IsIGNvdWxkIG5vdCBkZWxldGVcIixcbiAgXCJQbGVhc2UgaW5wdXQgUGljR28tQ29yZSBwYXRoLCBkZWZhdWx0IHVzaW5nIGVudmlyb25tZW50IHZhcmlhYmxlc1wiOlxuICAgIFwiUGxlYXNlIGlucHV0IFBpY0dvLUNvcmUgcGF0aCwgZGVmYXVsdCB1c2luZyBlbnZpcm9ubWVudCB2YXJpYWJsZXNcIixcbiAgXCJXb3JrIG9uIG5ldHdvcmtcIjogXCJXb3JrIG9uIG5ldHdvcmtcIixcbiAgXCJXb3JrIG9uIG5ldHdvcmsgRGVzY3JpcHRpb25cIjpcbiAgICBcIkFsbG93IHVwbG9hZCBuZXR3b3JrIGltYWdlIGJ5ICdVcGxvYWQgYWxsJyBjb21tYW5kLlxcbiBPciB3aGVuIHlvdSBwYXN0ZSwgbWQgc3RhbmRhcmQgaW1hZ2UgbGluayBpbiB5b3VyIGNsaXBib2FyZCB3aWxsIGJlIGF1dG8gdXBsb2FkLlwiLFxuICBmaXhQYXRoOiBcImZpeFBhdGhcIixcbiAgZml4UGF0aFdhcm5pbmc6XG4gICAgXCJUaGlzIG9wdGlvbiBpcyB1c2VkIHRvIGZpeCBQaWNHby1jb3JlIHVwbG9hZCBmYWlsdXJlcyBvbiBMaW51eCBhbmQgTWFjLiBJdCBtb2RpZmllcyB0aGUgUEFUSCB2YXJpYWJsZSB3aXRoaW4gT2JzaWRpYW4uIElmIE9ic2lkaWFuIGVuY291bnRlcnMgYW55IGJ1Z3MsIHR1cm4gb2ZmIHRoZSBvcHRpb24sIHRyeSBhZ2FpbiEgXCIsXG4gIFwiVXBsb2FkIHdoZW4gY2xpcGJvYXJkIGhhcyBpbWFnZSBhbmQgdGV4dCB0b2dldGhlclwiOlxuICAgIFwiVXBsb2FkIHdoZW4gY2xpcGJvYXJkIGhhcyBpbWFnZSBhbmQgdGV4dCB0b2dldGhlclwiLFxuICBcIldoZW4geW91IGNvcHksIHNvbWUgYXBwbGljYXRpb24gbGlrZSBFeGNlbCB3aWxsIGltYWdlIGFuZCB0ZXh0IHRvIGNsaXBib2FyZCwgeW91IGNhbiB1cGxvYWQgb3Igbm90LlwiOlxuICAgIFwiV2hlbiB5b3UgY29weSwgc29tZSBhcHBsaWNhdGlvbiBsaWtlIEV4Y2VsIHdpbGwgaW1hZ2UgYW5kIHRleHQgdG8gY2xpcGJvYXJkLCB5b3UgY2FuIHVwbG9hZCBvciBub3QuXCIsXG4gIFwiTmV0d29yayBEb21haW4gQmxhY2sgTGlzdFwiOiBcIk5ldHdvcmsgRG9tYWluIEJsYWNrIExpc3RcIixcbiAgXCJOZXR3b3JrIERvbWFpbiBCbGFjayBMaXN0IERlc2NyaXB0aW9uXCI6XG4gICAgXCJJbWFnZSBpbiB0aGUgZG9tYWluIGxpc3Qgd2lsbCBub3QgYmUgdXBsb2FkLHVzZSBjb21tYSBzZXBhcmF0ZWRcIixcbiAgXCJEZWxldGUgc291cmNlIGZpbGUgYWZ0ZXIgeW91IHVwbG9hZCBmaWxlXCI6XG4gICAgXCJEZWxldGUgc291cmNlIGZpbGUgYWZ0ZXIgeW91IHVwbG9hZCBmaWxlXCIsXG4gIFwiRGVsZXRlIHNvdXJjZSBmaWxlIGluIG9iIGFzc2V0cyBhZnRlciB5b3UgdXBsb2FkIGZpbGUuXCI6XG4gICAgXCJEZWxldGUgc291cmNlIGZpbGUgaW4gb2IgYXNzZXRzIGFmdGVyIHlvdSB1cGxvYWQgZmlsZS5cIixcbiAgXCJJbWFnZSBkZXNjXCI6IFwiSW1hZ2UgZGVzY1wiLFxuICByZXNlcnZlOiBcImRlZmF1bHRcIixcbiAgXCJyZW1vdmUgYWxsXCI6IFwibm9uZVwiLFxuICBcInJlbW92ZSBkZWZhdWx0XCI6IFwicmVtb3ZlIGltYWdlLnBuZ1wiLFxuICBcIlJlbW90ZSBzZXJ2ZXIgbW9kZVwiOiBcIlJlbW90ZSBzZXJ2ZXIgbW9kZVwiLFxuICBcIlJlbW90ZSBzZXJ2ZXIgbW9kZSBkZXNjXCI6XG4gICAgXCJJZiB5b3UgaGF2ZSBkZXBsb3llZCBwaWNsaXN0LWNvcmUgb3IgcGljbGlzdCBvbiB0aGUgc2VydmVyLlwiLFxuICBcIkNhbiBub3QgZmluZCBpbWFnZSBmaWxlXCI6IFwiQ2FuIG5vdCBmaW5kIGltYWdlIGZpbGVcIixcbiAgXCJGaWxlIGhhcyBiZWVuIGNoYW5nZWRkLCB1cGxvYWQgZmFpbHVyZVwiOlxuICAgIFwiRmlsZSBoYXMgYmVlbiBjaGFuZ2VkZCwgdXBsb2FkIGZhaWx1cmVcIixcbiAgXCJGaWxlIGhhcyBiZWVuIGNoYW5nZWRkLCBkb3dubG9hZCBmYWlsdXJlXCI6XG4gICAgXCJGaWxlIGhhcyBiZWVuIGNoYW5nZWRkLCBkb3dubG9hZCBmYWlsdXJlXCIsXG4gIFwiV2FybmluZzogdXBsb2FkIGZpbGVzIGlzIGRpZmZlcmVudCBvZiByZWNpdmVyIGZpbGVzIGZyb20gYXBpXCI6XG4gICAgXCJXYXJuaW5nOiB1cGxvYWQgZmlsZXMgbnVtIGlzIGRpZmZlcmVudCBvZiByZWNpdmVyIGZpbGVzIGZyb20gYXBpXCIsXG59O1xuIiwiLy8gQnJpdGlzaCBFbmdsaXNoXG5cbmV4cG9ydCBkZWZhdWx0IHt9O1xuIiwiLy8gRXNwYcOxb2xcblxuZXhwb3J0IGRlZmF1bHQge307XG4iLCIvLyBmcmFuw6dhaXNcblxuZXhwb3J0IGRlZmF1bHQge307XG4iLCIvLyDgpLngpL/gpKjgpY3gpKbgpYBcblxuZXhwb3J0IGRlZmF1bHQge307XG4iLCIvLyBCYWhhc2EgSW5kb25lc2lhXG5cbmV4cG9ydCBkZWZhdWx0IHt9O1xuIiwiLy8gSXRhbGlhbm9cblxuZXhwb3J0IGRlZmF1bHQge307XG4iLCIvLyDml6XmnKzoqp5cblxuZXhwb3J0IGRlZmF1bHQge307IiwiLy8g7ZWc6rWt7Ja0XG5cbmV4cG9ydCBkZWZhdWx0IHt9O1xuIiwiLy8gTmVkZXJsYW5kc1xuXG5leHBvcnQgZGVmYXVsdCB7fTtcbiIsIi8vIE5vcnNrXG5cbmV4cG9ydCBkZWZhdWx0IHt9O1xuIiwiLy8gasSZenlrIHBvbHNraVxuXG5leHBvcnQgZGVmYXVsdCB7fTtcbiIsIi8vIFBvcnR1Z3XDqnNcblxuZXhwb3J0IGRlZmF1bHQge307XG4iLCIvLyBQb3J0dWd1w6pzIGRvIEJyYXNpbFxuLy8gQnJhemlsaWFuIFBvcnR1Z3Vlc2VcblxuZXhwb3J0IGRlZmF1bHQge307IiwiLy8gUm9tw6JuxINcblxuZXhwb3J0IGRlZmF1bHQge307XG4iLCIvLyDRgNGD0YHRgdC60LjQuVxuXG5leHBvcnQgZGVmYXVsdCB7fTtcbiIsIi8vIFTDvHJrw6dlXG5cbmV4cG9ydCBkZWZhdWx0IHt9O1xuIiwiLy8g566A5L2T5Lit5paHXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgLy8gc2V0dGluZy50c1xuICBcIlBsdWdpbiBTZXR0aW5nc1wiOiBcIuaPkuS7tuiuvue9rlwiLFxuICBcIkF1dG8gcGFzdGVkIHVwbG9hZFwiOiBcIuWJquWIh+adv+iHquWKqOS4iuS8oFwiLFxuICBcIklmIHlvdSBzZXQgdGhpcyB2YWx1ZSB0cnVlLCB3aGVuIHlvdSBwYXN0ZSBpbWFnZSwgaXQgd2lsbCBiZSBhdXRvIHVwbG9hZGVkKHlvdSBzaG91bGQgc2V0IHRoZSBwaWNHbyBzZXJ2ZXIgcmlnaHRseSlcIjpcbiAgICBcIuWQr+eUqOivpemAiemhueWQju+8jOm7j+i0tOWbvueJh+aXtuS8muiHquWKqOS4iuS8oO+8iOS9oOmcgOimgeato+ehrumFjee9rnBpY2dv77yJXCIsXG4gIFwiRGVmYXVsdCB1cGxvYWRlclwiOiBcIum7mOiupOS4iuS8oOWZqFwiLFxuICBcIlBpY0dvIHNlcnZlclwiOiBcIlBpY0dvIHNlcnZlciDkuIrkvKDmjqXlj6NcIixcbiAgXCJQaWNHbyBzZXJ2ZXIgZGVzY1wiOiBcIuS4iuS8oOaOpeWPo++8jOS9v+eUqFBpY0xpc3Tml7blj6/pgJrov4forr7nva5VUkzlj4LmlbDmjIflrprlm77luorlkozphY3nva5cIixcbiAgXCJQbGVhc2UgaW5wdXQgUGljR28gc2VydmVyXCI6IFwi6K+36L6T5YWl5LiK5Lyg5o6l5Y+j5Zyw5Z2AXCIsXG4gIFwiUGljR28gZGVsZXRlIHNlcnZlclwiOiBcIlBpY0dvIHNlcnZlciDliKDpmaTmjqXlj6Mo6K+35L2/55SoUGljTGlzdOadpeWQr+eUqOatpOWKn+iDvSlcIixcbiAgXCJQaWNMaXN0IGRlc2NcIjogXCJQaWNMaXN05pivUGljR2/kuozmrKHlvIDlj5HniYjvvIzor7dHaXRodWLmkJzntKJQaWNMaXN05LiL6L29XCIsXG4gIFwiUGxlYXNlIGlucHV0IFBpY0dvIGRlbGV0ZSBzZXJ2ZXJcIjogXCLor7fovpPlhaXliKDpmaTmjqXlj6PlnLDlnYBcIixcbiAgXCJEZWxldGUgaW1hZ2UgdXNpbmcgUGljTGlzdFwiOiBcIuS9v+eUqCBQaWNMaXN0IOWIoOmZpOWbvueJh1wiLFxuICBcIlBpY0dvLUNvcmUgcGF0aFwiOiBcIlBpY0dvLUNvcmUg6Lev5b6EXCIsXG4gIFwiRGVsZXRlIHN1Y2Nlc3NmdWxseVwiOiBcIuWIoOmZpOaIkOWKn1wiLFxuICBcIkRlbGV0ZSBmYWlsZWRcIjogXCLliKDpmaTlpLHotKVcIixcbiAgXCJFcnJvciwgY291bGQgbm90IGRlbGV0ZVwiOiBcIumUmeivr++8jOaXoOazleWIoOmZpFwiLFxuICBcIkltYWdlIHNpemUgc3VmZml4XCI6IFwi5Zu+54mH5aSn5bCP5ZCO57yAXCIsXG4gIFwiSW1hZ2Ugc2l6ZSBzdWZmaXggRGVzY3JpcHRpb25cIjogXCLmr5TlpoLvvJp8MzAwIOeUqOS6juiwg+aVtOWbvueJh+Wkp+Wwj1wiLFxuICBcIlBsZWFzZSBpbnB1dCBpbWFnZSBzaXplIHN1ZmZpeFwiOiBcIuivt+i+k+WFpeWbvueJh+Wkp+Wwj+WQjue8gFwiLFxuICBcIlBsZWFzZSBpbnB1dCBQaWNHby1Db3JlIHBhdGgsIGRlZmF1bHQgdXNpbmcgZW52aXJvbm1lbnQgdmFyaWFibGVzXCI6XG4gICAgXCLor7fovpPlhaUgUGljR28tQ29yZSBwYXRo77yM6buY6K6k5L2/55So546v5aKD5Y+Y6YePXCIsXG4gIFwiV29yayBvbiBuZXR3b3JrXCI6IFwi5bqU55So572R57uc5Zu+54mHXCIsXG4gIFwiV29yayBvbiBuZXR3b3JrIERlc2NyaXB0aW9uXCI6XG4gICAgXCLlvZPkvaDkuIrkvKDmiYDmnInlm77niYfml7bvvIzkuZ/kvJrkuIrkvKDnvZHnu5zlm77niYfjgILku6Xlj4rlvZPkvaDov5vooYzpu4/otLTml7bvvIzliarliIfmnb/kuK3nmoTmoIflh4YgbWQg5Zu+54mH5Lya6KKr5LiK5LygXCIsXG4gIGZpeFBhdGg6IFwi5L+u5q2jUEFUSOWPmOmHj1wiLFxuICBmaXhQYXRoV2FybmluZzpcbiAgICBcIuatpOmAiemhueeUqOS6juS/ruWkjUxpbnV45ZKMTWFj5LiKIFBpY0dvLUNvcmUg5LiK5Lyg5aSx6LSl55qE6Zeu6aKY44CC5a6D5Lya5L+u5pS5IE9ic2lkaWFuIOWGheeahCBQQVRIIOWPmOmHj++8jOWmguaenCBPYnNpZGlhbiDpgYfliLDku7vkvZVCVUfvvIzlhYjlhbPpl63ov5nkuKrpgInpobnor5Xor5XvvIFcIixcbiAgXCJVcGxvYWQgd2hlbiBjbGlwYm9hcmQgaGFzIGltYWdlIGFuZCB0ZXh0IHRvZ2V0aGVyXCI6XG4gICAgXCLlvZPliarliIfmnb/lkIzml7bmi6XmnInmlofmnKzlkozlm77niYfliarliIfmnb/mlbDmja7ml7bmmK/lkKbkuIrkvKDlm77niYdcIixcbiAgXCJXaGVuIHlvdSBjb3B5LCBzb21lIGFwcGxpY2F0aW9uIGxpa2UgRXhjZWwgd2lsbCBpbWFnZSBhbmQgdGV4dCB0byBjbGlwYm9hcmQsIHlvdSBjYW4gdXBsb2FkIG9yIG5vdC5cIjpcbiAgICBcIuW9k+S9oOWkjeWItuaXtu+8jOafkOS6m+W6lOeUqOS+i+WmgiBFeGNlbCDkvJrlnKjliarliIfmnb/lkIzml7bmlofmnKzlkozlm77lg4/mlbDmja7vvIznoa7orqTmmK/lkKbkuIrkvKDjgIJcIixcbiAgXCJOZXR3b3JrIERvbWFpbiBCbGFjayBMaXN0XCI6IFwi572R57uc5Zu+54mH5Z+f5ZCN6buR5ZCN5Y2VXCIsXG4gIFwiTmV0d29yayBEb21haW4gQmxhY2sgTGlzdCBEZXNjcmlwdGlvblwiOlxuICAgIFwi6buR5ZCN5Y2V5Z+f5ZCN5Lit55qE5Zu+54mH5bCG5LiN5Lya6KKr5LiK5Lyg77yM55So6Iux5paH6YCX5Y+35YiG5YmyXCIsXG4gIFwiRGVsZXRlIHNvdXJjZSBmaWxlIGFmdGVyIHlvdSB1cGxvYWQgZmlsZVwiOiBcIuS4iuS8oOaWh+S7tuWQjuenu+mZpOa6kOaWh+S7tlwiLFxuICBcIkRlbGV0ZSBzb3VyY2UgZmlsZSBpbiBvYiBhc3NldHMgYWZ0ZXIgeW91IHVwbG9hZCBmaWxlLlwiOlxuICAgIFwi5LiK5Lyg5paH5Lu25ZCO56e76Zmk5Zyob2LpmYTku7bmlofku7blpLnkuK3nmoTmlofku7ZcIixcbiAgXCJJbWFnZSBkZXNjXCI6IFwi5Zu+54mH5o+P6L+wXCIsXG4gIHJlc2VydmU6IFwi6buY6K6kXCIsXG4gIFwicmVtb3ZlIGFsbFwiOiBcIuaXoFwiLFxuICBcInJlbW92ZSBkZWZhdWx0XCI6IFwi56e76ZmkaW1hZ2UucG5nXCIsXG4gIFwiUmVtb3RlIHNlcnZlciBtb2RlXCI6IFwi6L+c56iL5pyN5Yqh5Zmo5qih5byPXCIsXG4gIFwiUmVtb3RlIHNlcnZlciBtb2RlIGRlc2NcIjogXCLlpoLmnpzkvaDlnKjmnI3liqHlmajpg6jnvbLkuoZwaWNsaXN0LWNvcmXmiJbogIVwaWNsaXN0XCIsXG4gIFwiQ2FuIG5vdCBmaW5kIGltYWdlIGZpbGVcIjogXCLmsqHmnInop6PmnpDliLDlm77lg4/mlofku7ZcIixcbiAgXCJGaWxlIGhhcyBiZWVuIGNoYW5nZWRkLCB1cGxvYWQgZmFpbHVyZVwiOiBcIuW9k+WJjeaWh+S7tuW3suWPmOabtO+8jOS4iuS8oOWksei0pVwiLFxuICBcIkZpbGUgaGFzIGJlZW4gY2hhbmdlZGQsIGRvd25sb2FkIGZhaWx1cmVcIjogXCLlvZPliY3mlofku7blt7Llj5jmm7TvvIzkuIvovb3lpLHotKVcIixcbiAgXCJXYXJuaW5nOiB1cGxvYWQgZmlsZXMgaXMgZGlmZmVyZW50IG9mIHJlY2l2ZXIgZmlsZXMgZnJvbSBhcGlcIjpcbiAgICBcIuitpuWRiu+8muS4iuS8oOeahOaWh+S7tuS4juaOpeWPo+i/lOWbnueahOaWh+S7tuaVsOmHj+S4jeS4gOiHtFwiLFxufTtcbiIsIi8vIOe5gemrlOS4reaWh1xuXG5leHBvcnQgZGVmYXVsdCB7fTtcbiIsImltcG9ydCB7IG1vbWVudCB9IGZyb20gJ29ic2lkaWFuJztcblxuaW1wb3J0IGFyIGZyb20gJy4vbG9jYWxlL2FyJztcbmltcG9ydCBjeiBmcm9tICcuL2xvY2FsZS9jeic7XG5pbXBvcnQgZGEgZnJvbSAnLi9sb2NhbGUvZGEnO1xuaW1wb3J0IGRlIGZyb20gJy4vbG9jYWxlL2RlJztcbmltcG9ydCBlbiBmcm9tICcuL2xvY2FsZS9lbic7XG5pbXBvcnQgZW5HQiBmcm9tICcuL2xvY2FsZS9lbi1nYic7XG5pbXBvcnQgZXMgZnJvbSAnLi9sb2NhbGUvZXMnO1xuaW1wb3J0IGZyIGZyb20gJy4vbG9jYWxlL2ZyJztcbmltcG9ydCBoaSBmcm9tICcuL2xvY2FsZS9oaSc7XG5pbXBvcnQgaWQgZnJvbSAnLi9sb2NhbGUvaWQnO1xuaW1wb3J0IGl0IGZyb20gJy4vbG9jYWxlL2l0JztcbmltcG9ydCBqYSBmcm9tICcuL2xvY2FsZS9qYSc7XG5pbXBvcnQga28gZnJvbSAnLi9sb2NhbGUva28nO1xuaW1wb3J0IG5sIGZyb20gJy4vbG9jYWxlL25sJztcbmltcG9ydCBubyBmcm9tICcuL2xvY2FsZS9ubyc7XG5pbXBvcnQgcGwgZnJvbSAnLi9sb2NhbGUvcGwnO1xuaW1wb3J0IHB0IGZyb20gJy4vbG9jYWxlL3B0JztcbmltcG9ydCBwdEJSIGZyb20gJy4vbG9jYWxlL3B0LWJyJztcbmltcG9ydCBybyBmcm9tICcuL2xvY2FsZS9ybyc7XG5pbXBvcnQgcnUgZnJvbSAnLi9sb2NhbGUvcnUnO1xuaW1wb3J0IHRyIGZyb20gJy4vbG9jYWxlL3RyJztcbmltcG9ydCB6aENOIGZyb20gJy4vbG9jYWxlL3poLWNuJztcbmltcG9ydCB6aFRXIGZyb20gJy4vbG9jYWxlL3poLXR3JztcblxuY29uc3QgbG9jYWxlTWFwOiB7IFtrOiBzdHJpbmddOiBQYXJ0aWFsPHR5cGVvZiBlbj4gfSA9IHtcbiAgYXIsXG4gIGNzOiBjeixcbiAgZGEsXG4gIGRlLFxuICBlbixcbiAgJ2VuLWdiJzogZW5HQixcbiAgZXMsXG4gIGZyLFxuICBoaSxcbiAgaWQsXG4gIGl0LFxuICBqYSxcbiAga28sXG4gIG5sLFxuICBubjogbm8sXG4gIHBsLFxuICBwdCxcbiAgJ3B0LWJyJzogcHRCUixcbiAgcm8sXG4gIHJ1LFxuICB0cixcbiAgJ3poLWNuJzogemhDTixcbiAgJ3poLXR3JzogemhUVyxcbn07XG5cbmNvbnN0IGxvY2FsZSA9IGxvY2FsZU1hcFttb21lbnQubG9jYWxlKCldO1xuXG5leHBvcnQgZnVuY3Rpb24gdChzdHI6IGtleW9mIHR5cGVvZiBlbik6IHN0cmluZyB7XG4gIHJldHVybiAobG9jYWxlICYmIGxvY2FsZVtzdHJdKSB8fCBlbltzdHJdO1xufVxuIiwiaW1wb3J0IHsgbm9ybWFsaXplUGF0aCwgTm90aWNlLCByZXF1ZXN0VXJsIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IHJlbGF0aXZlLCBqb2luLCBwYXJzZSB9IGZyb20gXCJwYXRoLWJyb3dzZXJpZnlcIjtcbmltcG9ydCBpbWFnZVR5cGUgZnJvbSBcImltYWdlLXR5cGVcIjtcblxuaW1wb3J0IHsgZ2V0VXJsQXNzZXQsIHV1aWQgfSBmcm9tIFwiLi91dGlsc1wiO1xuaW1wb3J0IHsgdCB9IGZyb20gXCIuL2xhbmcvaGVscGVyc1wiO1xuaW1wb3J0IHR5cGUgaW1hZ2VBdXRvVXBsb2FkUGx1Z2luIGZyb20gXCIuL21haW5cIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRvd25sb2FkQWxsSW1hZ2VGaWxlcyhwbHVnaW46IGltYWdlQXV0b1VwbG9hZFBsdWdpbikge1xuICBjb25zdCBhY3RpdmVGaWxlID0gcGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuICBjb25zdCBmb2xkZXJQYXRoID0gYXdhaXQgcGx1Z2luLmFwcC5maWxlTWFuYWdlci5nZXRBdmFpbGFibGVQYXRoRm9yQXR0YWNobWVudChcbiAgICBcIlwiXG4gICk7XG5cbiAgY29uc3QgZmlsZUFycmF5ID0gcGx1Z2luLmhlbHBlci5nZXRBbGxGaWxlcygpO1xuXG4gIGlmICghKGF3YWl0IHBsdWdpbi5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMoZm9sZGVyUGF0aCkpKSB7XG4gICAgYXdhaXQgcGx1Z2luLmFwcC52YXVsdC5hZGFwdGVyLm1rZGlyKGZvbGRlclBhdGgpO1xuICB9XG5cbiAgbGV0IGltYWdlQXJyYXkgPSBbXTtcbiAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVBcnJheSkge1xuICAgIGlmICghZmlsZS5wYXRoLnN0YXJ0c1dpdGgoXCJodHRwXCIpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBjb25zdCB1cmwgPSBmaWxlLnBhdGg7XG4gICAgY29uc3QgYXNzZXQgPSBnZXRVcmxBc3NldCh1cmwpO1xuICAgIGxldCBuYW1lID0gZGVjb2RlVVJJKHBhcnNlKGFzc2V0KS5uYW1lKS5yZXBsYWNlQWxsKC9bXFxcXFxcXFwvOio/XFxcIjw+fF0vZywgXCItXCIpO1xuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBkb3dubG9hZChwbHVnaW4sIHVybCwgZm9sZGVyUGF0aCwgbmFtZSk7XG4gICAgaWYgKHJlc3BvbnNlLm9rKSB7XG4gICAgICBjb25zdCBhY3RpdmVGb2xkZXIgPSBwbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCkucGFyZW50LnBhdGg7XG5cbiAgICAgIGltYWdlQXJyYXkucHVzaCh7XG4gICAgICAgIHNvdXJjZTogZmlsZS5zb3VyY2UsXG4gICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgIHBhdGg6IG5vcm1hbGl6ZVBhdGgoXG4gICAgICAgICAgcmVsYXRpdmUobm9ybWFsaXplUGF0aChhY3RpdmVGb2xkZXIpLCBub3JtYWxpemVQYXRoKHJlc3BvbnNlLnBhdGgpKVxuICAgICAgICApLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgbGV0IHZhbHVlID0gcGx1Z2luLmhlbHBlci5nZXRWYWx1ZSgpO1xuICBpbWFnZUFycmF5Lm1hcChpbWFnZSA9PiB7XG4gICAgbGV0IG5hbWUgPSBwbHVnaW4uaGFuZGxlTmFtZShpbWFnZS5uYW1lKTtcblxuICAgIHZhbHVlID0gdmFsdWUucmVwbGFjZShpbWFnZS5zb3VyY2UsIGAhWyR7bmFtZX1dKCR7ZW5jb2RlVVJJKGltYWdlLnBhdGgpfSlgKTtcbiAgfSk7XG5cbiAgY29uc3QgY3VycmVudEZpbGUgPSBwbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gIGlmIChhY3RpdmVGaWxlLnBhdGggIT09IGN1cnJlbnRGaWxlLnBhdGgpIHtcbiAgICBuZXcgTm90aWNlKHQoXCJGaWxlIGhhcyBiZWVuIGNoYW5nZWRkLCBkb3dubG9hZCBmYWlsdXJlXCIpKTtcbiAgICByZXR1cm47XG4gIH1cbiAgcGx1Z2luLmhlbHBlci5zZXRWYWx1ZSh2YWx1ZSk7XG5cbiAgbmV3IE5vdGljZShcbiAgICBgYWxsOiAke2ZpbGVBcnJheS5sZW5ndGh9XFxuc3VjY2VzczogJHtpbWFnZUFycmF5Lmxlbmd0aH1cXG5mYWlsZWQ6ICR7XG4gICAgICBmaWxlQXJyYXkubGVuZ3RoIC0gaW1hZ2VBcnJheS5sZW5ndGhcbiAgICB9YFxuICApO1xufVxuXG5hc3luYyBmdW5jdGlvbiBkb3dubG9hZChcbiAgcGx1Z2luOiBpbWFnZUF1dG9VcGxvYWRQbHVnaW4sXG4gIHVybDogc3RyaW5nLFxuICBmb2xkZXJQYXRoOiBzdHJpbmcsXG4gIG5hbWU6IHN0cmluZ1xuKSB7XG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybCB9KTtcblxuICBpZiAocmVzcG9uc2Uuc3RhdHVzICE9PSAyMDApIHtcbiAgICByZXR1cm4ge1xuICAgICAgb2s6IGZhbHNlLFxuICAgICAgbXNnOiBcImVycm9yXCIsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHR5cGUgPSBhd2FpdCBpbWFnZVR5cGUobmV3IFVpbnQ4QXJyYXkocmVzcG9uc2UuYXJyYXlCdWZmZXIpKTtcbiAgaWYgKCF0eXBlKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG9rOiBmYWxzZSxcbiAgICAgIG1zZzogXCJlcnJvclwiLFxuICAgIH07XG4gIH1cblxuICB0cnkge1xuICAgIGxldCBwYXRoID0gbm9ybWFsaXplUGF0aChqb2luKGZvbGRlclBhdGgsIGAke25hbWV9LiR7dHlwZS5leHR9YCkpO1xuXG4gICAgLy8g5aaC5p6c5paH5Lu25ZCN5bey5a2Y5Zyo77yM5YiZ55So6ZqP5py65YC85pu/5o2i77yM5LiN5a+55paH5Lu25ZCO57yA6L+b6KGM5Yik5patXG4gICAgaWYgKGF3YWl0IHBsdWdpbi5hcHAudmF1bHQuYWRhcHRlci5leGlzdHMocGF0aCkpIHtcbiAgICAgIHBhdGggPSBub3JtYWxpemVQYXRoKGpvaW4oZm9sZGVyUGF0aCwgYCR7dXVpZCgpfS4ke3R5cGUuZXh0fWApKTtcbiAgICB9XG5cbiAgICBwbHVnaW4uYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGVCaW5hcnkocGF0aCwgcmVzcG9uc2UuYXJyYXlCdWZmZXIpO1xuICAgIHJldHVybiB7XG4gICAgICBvazogdHJ1ZSxcbiAgICAgIG1zZzogXCJva1wiLFxuICAgICAgcGF0aDogcGF0aCxcbiAgICAgIHR5cGUsXG4gICAgfTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG9rOiBmYWxzZSxcbiAgICAgIG1zZzogZXJyLFxuICAgIH07XG4gIH1cbn1cbiIsImltcG9ydCB7IHJlYWRGaWxlIH0gZnJvbSBcImZzXCI7XG5cbmltcG9ydCB7IFBsdWdpblNldHRpbmdzIH0gZnJvbSBcIi4vc2V0dGluZ1wiO1xuaW1wb3J0IHsgc3RyZWFtVG9TdHJpbmcsIGdldExhc3RJbWFnZSwgYnVmZmVyVG9BcnJheUJ1ZmZlciB9IGZyb20gXCIuL3V0aWxzXCI7XG5pbXBvcnQgeyBleGVjIH0gZnJvbSBcImNoaWxkX3Byb2Nlc3NcIjtcbmltcG9ydCB7IHJlcXVlc3RVcmwgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCBpbWFnZUF1dG9VcGxvYWRQbHVnaW4gZnJvbSBcIi4vbWFpblwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFBpY0dvUmVzcG9uc2Uge1xuICBtc2c6IHN0cmluZztcbiAgcmVzdWx0OiBzdHJpbmdbXTtcbiAgZnVsbFJlc3VsdDogUmVjb3JkPHN0cmluZywgYW55PltdO1xufVxuXG5leHBvcnQgY2xhc3MgUGljR29VcGxvYWRlciB7XG4gIHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncztcbiAgcGx1Z2luOiBpbWFnZUF1dG9VcGxvYWRQbHVnaW47XG5cbiAgY29uc3RydWN0b3Ioc2V0dGluZ3M6IFBsdWdpblNldHRpbmdzLCBwbHVnaW46IGltYWdlQXV0b1VwbG9hZFBsdWdpbikge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGFzeW5jIHVwbG9hZEZpbGVzKGZpbGVMaXN0OiBBcnJheTxzdHJpbmc+KTogUHJvbWlzZTxhbnk+IHtcbiAgICBsZXQgcmVzcG9uc2U6IGFueTtcbiAgICBsZXQgZGF0YTogUGljR29SZXNwb25zZTtcblxuICAgIGlmICh0aGlzLnNldHRpbmdzLnJlbW90ZVNlcnZlck1vZGUpIHtcbiAgICAgIGNvbnN0IGZpbGVzID0gW107XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZpbGVMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSBmaWxlTGlzdFtpXTtcbiAgICAgICAgY29uc3QgYnVmZmVyOiBCdWZmZXIgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgcmVhZEZpbGUoZmlsZSwgKGVyciwgZGF0YSkgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc29sdmUoZGF0YSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBhcnJheUJ1ZmZlciA9IGJ1ZmZlclRvQXJyYXlCdWZmZXIoYnVmZmVyKTtcbiAgICAgICAgZmlsZXMucHVzaChuZXcgRmlsZShbYXJyYXlCdWZmZXJdLCBmaWxlKSk7XG4gICAgICB9XG4gICAgICByZXNwb25zZSA9IGF3YWl0IHRoaXMudXBsb2FkRmlsZUJ5RGF0YShmaWxlcyk7XG4gICAgICBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3RVcmwoe1xuICAgICAgICB1cmw6IHRoaXMuc2V0dGluZ3MudXBsb2FkU2VydmVyLFxuICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgbGlzdDogZmlsZUxpc3QgfSksXG4gICAgICB9KTtcbiAgICAgIGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uO1xuICAgIH1cblxuICAgIC8vIHBpY2xpc3RcbiAgICBpZiAoZGF0YS5mdWxsUmVzdWx0KSB7XG4gICAgICBjb25zdCB1cGxvYWRVcmxGdWxsUmVzdWx0TGlzdCA9IGRhdGEuZnVsbFJlc3VsdCB8fCBbXTtcbiAgICAgIHRoaXMuc2V0dGluZ3MudXBsb2FkZWRJbWFnZXMgPSBbXG4gICAgICAgIC4uLih0aGlzLnNldHRpbmdzLnVwbG9hZGVkSW1hZ2VzIHx8IFtdKSxcbiAgICAgICAgLi4udXBsb2FkVXJsRnVsbFJlc3VsdExpc3QsXG4gICAgICBdO1xuICAgIH1cblxuICAgIHJldHVybiBkYXRhO1xuICB9XG5cbiAgYXN5bmMgdXBsb2FkRmlsZUJ5RGF0YShmaWxlTGlzdDogRmlsZUxpc3QgfCBGaWxlW10pOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IGZvcm0gPSBuZXcgRm9ybURhdGEoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZpbGVMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBmb3JtLmFwcGVuZChcImxpc3RcIiwgZmlsZUxpc3RbaV0pO1xuICAgIH1cblxuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICBtZXRob2Q6IFwicG9zdFwiLFxuICAgICAgYm9keTogZm9ybSxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh0aGlzLnNldHRpbmdzLnVwbG9hZFNlcnZlciwgb3B0aW9ucyk7XG4gICAgY29uc29sZS5sb2coXCJyZXNwb25zZVwiLCByZXNwb25zZSk7XG4gICAgcmV0dXJuIHJlc3BvbnNlO1xuICB9XG5cbiAgYXN5bmMgdXBsb2FkRmlsZUJ5Q2xpcGJvYXJkKGZpbGVMaXN0PzogRmlsZUxpc3QpOiBQcm9taXNlPGFueT4ge1xuICAgIGxldCBkYXRhOiBQaWNHb1Jlc3BvbnNlO1xuICAgIGxldCByZXM6IGFueTtcblxuICAgIGlmICh0aGlzLnNldHRpbmdzLnJlbW90ZVNlcnZlck1vZGUpIHtcbiAgICAgIHJlcyA9IGF3YWl0IHRoaXMudXBsb2FkRmlsZUJ5RGF0YShmaWxlTGlzdCk7XG4gICAgICBkYXRhID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzID0gYXdhaXQgcmVxdWVzdFVybCh7XG4gICAgICAgIHVybDogdGhpcy5zZXR0aW5ncy51cGxvYWRTZXJ2ZXIsXG4gICAgICAgIG1ldGhvZDogXCJQT1NUXCIsXG4gICAgICB9KTtcblxuICAgICAgZGF0YSA9IGF3YWl0IHJlcy5qc29uO1xuICAgIH1cblxuICAgIGlmIChyZXMuc3RhdHVzICE9PSAyMDApIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNvZGU6IC0xLFxuICAgICAgICBtc2c6IGRhdGEubXNnLFxuICAgICAgICBkYXRhOiBcIlwiLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBwaWNsaXN0XG4gICAgaWYgKGRhdGEuZnVsbFJlc3VsdCkge1xuICAgICAgY29uc3QgdXBsb2FkVXJsRnVsbFJlc3VsdExpc3QgPSBkYXRhLmZ1bGxSZXN1bHQgfHwgW107XG4gICAgICB0aGlzLnNldHRpbmdzLnVwbG9hZGVkSW1hZ2VzID0gW1xuICAgICAgICAuLi4odGhpcy5zZXR0aW5ncy51cGxvYWRlZEltYWdlcyB8fCBbXSksXG4gICAgICAgIC4uLnVwbG9hZFVybEZ1bGxSZXN1bHRMaXN0LFxuICAgICAgXTtcbiAgICAgIHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBjb2RlOiAwLFxuICAgICAgbXNnOiBcInN1Y2Nlc3NcIixcbiAgICAgIGRhdGE6IHR5cGVvZiBkYXRhLnJlc3VsdCA9PSBcInN0cmluZ1wiID8gZGF0YS5yZXN1bHQgOiBkYXRhLnJlc3VsdFswXSxcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQaWNHb0NvcmVVcGxvYWRlciB7XG4gIHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncztcbiAgcGx1Z2luOiBpbWFnZUF1dG9VcGxvYWRQbHVnaW47XG5cbiAgY29uc3RydWN0b3Ioc2V0dGluZ3M6IFBsdWdpblNldHRpbmdzLCBwbHVnaW46IGltYWdlQXV0b1VwbG9hZFBsdWdpbikge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGFzeW5jIHVwbG9hZEZpbGVzKGZpbGVMaXN0OiBBcnJheTxTdHJpbmc+KTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCBsZW5ndGggPSBmaWxlTGlzdC5sZW5ndGg7XG4gICAgbGV0IGNsaSA9IHRoaXMuc2V0dGluZ3MucGljZ29Db3JlUGF0aCB8fCBcInBpY2dvXCI7XG4gICAgbGV0IGNvbW1hbmQgPSBgJHtjbGl9IHVwbG9hZCAke2ZpbGVMaXN0XG4gICAgICAubWFwKGl0ZW0gPT4gYFwiJHtpdGVtfVwiYClcbiAgICAgIC5qb2luKFwiIFwiKX1gO1xuXG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5leGVjKGNvbW1hbmQpO1xuICAgIGNvbnN0IHNwbGl0TGlzdCA9IHJlcy5zcGxpdChcIlxcblwiKTtcbiAgICBjb25zdCBzcGxpdExpc3RMZW5ndGggPSBzcGxpdExpc3QubGVuZ3RoO1xuXG4gICAgY29uc3QgZGF0YSA9IHNwbGl0TGlzdC5zcGxpY2Uoc3BsaXRMaXN0TGVuZ3RoIC0gMSAtIGxlbmd0aCwgbGVuZ3RoKTtcblxuICAgIGlmIChyZXMuaW5jbHVkZXMoXCJQaWNHbyBFUlJPUlwiKSkge1xuICAgICAgY29uc29sZS5sb2coY29tbWFuZCwgcmVzKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgIG1zZzogXCLlpLHotKVcIixcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIHJlc3VsdDogZGF0YSxcbiAgICAgIH07XG4gICAgfVxuICAgIC8vIHtzdWNjZXNzOnRydWUscmVzdWx0OltdfVxuICB9XG5cbiAgLy8gUGljR28tQ29yZSDkuIrkvKDlpITnkIZcbiAgYXN5bmMgdXBsb2FkRmlsZUJ5Q2xpcGJvYXJkKCkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMudXBsb2FkQnlDbGlwKCk7XG4gICAgY29uc3Qgc3BsaXRMaXN0ID0gcmVzLnNwbGl0KFwiXFxuXCIpO1xuICAgIGNvbnN0IGxhc3RJbWFnZSA9IGdldExhc3RJbWFnZShzcGxpdExpc3QpO1xuXG4gICAgaWYgKGxhc3RJbWFnZSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY29kZTogMCxcbiAgICAgICAgbXNnOiBcInN1Y2Nlc3NcIixcbiAgICAgICAgZGF0YTogbGFzdEltYWdlLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5sb2coc3BsaXRMaXN0KTtcblxuICAgICAgLy8gbmV3IE5vdGljZShgXCJQbGVhc2UgY2hlY2sgUGljR28tQ29yZSBjb25maWdcIlxcbiR7cmVzfWApO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY29kZTogLTEsXG4gICAgICAgIG1zZzogYFwiUGxlYXNlIGNoZWNrIFBpY0dvLUNvcmUgY29uZmlnXCJcXG4ke3Jlc31gLFxuICAgICAgICBkYXRhOiBcIlwiLFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICAvLyBQaWNHby1Db3Jl55qE5Ymq5YiH5LiK5Lyg5Y+N6aaIXG4gIGFzeW5jIHVwbG9hZEJ5Q2xpcCgpIHtcbiAgICBsZXQgY29tbWFuZDtcbiAgICBpZiAodGhpcy5zZXR0aW5ncy5waWNnb0NvcmVQYXRoKSB7XG4gICAgICBjb21tYW5kID0gYCR7dGhpcy5zZXR0aW5ncy5waWNnb0NvcmVQYXRofSB1cGxvYWRgO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb21tYW5kID0gYHBpY2dvIHVwbG9hZGA7XG4gICAgfVxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMuZXhlYyhjb21tYW5kKTtcbiAgICAvLyBjb25zdCByZXMgPSBhd2FpdCB0aGlzLnNwYXduQ2hpbGQoKTtcblxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBhc3luYyBleGVjKGNvbW1hbmQ6IHN0cmluZykge1xuICAgIGxldCB7IHN0ZG91dCB9ID0gYXdhaXQgZXhlYyhjb21tYW5kKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBzdHJlYW1Ub1N0cmluZyhzdGRvdXQpO1xuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBhc3luYyBzcGF3bkNoaWxkKCkge1xuICAgIGNvbnN0IHsgc3Bhd24gfSA9IHJlcXVpcmUoXCJjaGlsZF9wcm9jZXNzXCIpO1xuICAgIGNvbnN0IGNoaWxkID0gc3Bhd24oXCJwaWNnb1wiLCBbXCJ1cGxvYWRcIl0sIHtcbiAgICAgIHNoZWxsOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgbGV0IGRhdGEgPSBcIlwiO1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgY2hpbGQuc3Rkb3V0KSB7XG4gICAgICBkYXRhICs9IGNodW5rO1xuICAgIH1cbiAgICBsZXQgZXJyb3IgPSBcIlwiO1xuICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgY2hpbGQuc3RkZXJyKSB7XG4gICAgICBlcnJvciArPSBjaHVuaztcbiAgICB9XG4gICAgY29uc3QgZXhpdENvZGUgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjaGlsZC5vbihcImNsb3NlXCIsIHJlc29sdmUpO1xuICAgIH0pO1xuXG4gICAgaWYgKGV4aXRDb2RlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYHN1YnByb2Nlc3MgZXJyb3IgZXhpdCAke2V4aXRDb2RlfSwgJHtlcnJvcn1gKTtcbiAgICB9XG4gICAgcmV0dXJuIGRhdGE7XG4gIH1cbn1cbiIsImltcG9ydCB7IElTdHJpbmdLZXlNYXAgfSBmcm9tIFwiLi91dGlsc1wiO1xuaW1wb3J0IHsgQXBwLCByZXF1ZXN0VXJsIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgaW1hZ2VBdXRvVXBsb2FkUGx1Z2luIGZyb20gXCIuL21haW5cIjtcblxuZXhwb3J0IGNsYXNzIFBpY0dvRGVsZXRlciB7XG4gIHBsdWdpbjogaW1hZ2VBdXRvVXBsb2FkUGx1Z2luO1xuXG4gIGNvbnN0cnVjdG9yKHBsdWdpbjogaW1hZ2VBdXRvVXBsb2FkUGx1Z2luKSB7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBhc3luYyBkZWxldGVJbWFnZShjb25maWdNYXA6IElTdHJpbmdLZXlNYXA8YW55PltdKSB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCByZXF1ZXN0VXJsKHtcbiAgICAgIHVybDogdGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVsZXRlU2VydmVyLFxuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgbGlzdDogY29uZmlnTWFwLFxuICAgICAgfSksXG4gICAgfSk7XG4gICAgY29uc3QgZGF0YSA9IHJlc3BvbnNlLmpzb247XG4gICAgcmV0dXJuIGRhdGE7XG4gIH1cbn1cbiIsImltcG9ydCB7IE1hcmtkb3duVmlldywgQXBwIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBwYXJzZSB9IGZyb20gXCJwYXRoLWJyb3dzZXJpZnlcIjtcblxuaW50ZXJmYWNlIEltYWdlIHtcbiAgcGF0aDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIHNvdXJjZTogc3RyaW5nO1xufVxuLy8gIVtdKC4vZHNhL2FhLnBuZykgbG9jYWwgaW1hZ2Ugc2hvdWxkIGhhcyBleHQsIHN1cHBvcnQgIVtdKDwuL2RzYS9hYS5wbmc+KSwgc3VwcG9ydCAhW10oaW1hZ2UucG5nIFwiYWx0XCIpXG4vLyAhW10oaHR0cHM6Ly9kYXNkYXNkYSkgaW50ZXJuZXQgaW1hZ2Ugc2hvdWxkIG5vdCBoYXMgZXh0XG5jb25zdCBSRUdFWF9GSUxFID1cbiAgL1xcIVxcWyguKj8pXFxdXFwoPChcXFMrXFwuXFx3Kyk+XFwpfFxcIVxcWyguKj8pXFxdXFwoKFxcUytcXC5cXHcrKSg/OlxccytcIlteXCJdKlwiKT9cXCl8XFwhXFxbKC4qPylcXF1cXCgoaHR0cHM/OlxcL1xcLy4qPylcXCkvZztcbmNvbnN0IFJFR0VYX1dJS0lfRklMRSA9IC9cXCFcXFtcXFsoLio/KShcXHMqP1xcfC4qPyk/XFxdXFxdL2c7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEhlbHBlciB7XG4gIGFwcDogQXBwO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwKSB7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gIH1cblxuICBnZXRGcm9udG1hdHRlclZhbHVlKGtleTogc3RyaW5nLCBkZWZhdWx0VmFsdWU6IGFueSA9IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuICAgIGlmICghZmlsZSkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgY29uc3QgcGF0aCA9IGZpbGUucGF0aDtcbiAgICBjb25zdCBjYWNoZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Q2FjaGUocGF0aCk7XG5cbiAgICBsZXQgdmFsdWUgPSBkZWZhdWx0VmFsdWU7XG4gICAgaWYgKGNhY2hlPy5mcm9udG1hdHRlciAmJiBjYWNoZS5mcm9udG1hdHRlci5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICB2YWx1ZSA9IGNhY2hlLmZyb250bWF0dGVyW2tleV07XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuXG4gIGdldEVkaXRvcigpIHtcbiAgICBjb25zdCBtZFZpZXcgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xuICAgIGlmIChtZFZpZXcpIHtcbiAgICAgIHJldHVybiBtZFZpZXcuZWRpdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBnZXRWYWx1ZSgpIHtcbiAgICBjb25zdCBlZGl0b3IgPSB0aGlzLmdldEVkaXRvcigpO1xuICAgIHJldHVybiBlZGl0b3IuZ2V0VmFsdWUoKTtcbiAgfVxuXG4gIHNldFZhbHVlKHZhbHVlOiBzdHJpbmcpIHtcbiAgICBjb25zdCBlZGl0b3IgPSB0aGlzLmdldEVkaXRvcigpO1xuICAgIGNvbnN0IHsgbGVmdCwgdG9wIH0gPSBlZGl0b3IuZ2V0U2Nyb2xsSW5mbygpO1xuICAgIGNvbnN0IHBvc2l0aW9uID0gZWRpdG9yLmdldEN1cnNvcigpO1xuXG4gICAgZWRpdG9yLnNldFZhbHVlKHZhbHVlKTtcbiAgICBlZGl0b3Iuc2Nyb2xsVG8obGVmdCwgdG9wKTtcbiAgICBlZGl0b3Iuc2V0Q3Vyc29yKHBvc2l0aW9uKTtcbiAgfVxuXG4gIC8vIGdldCBhbGwgZmlsZSB1cmxzLCBpbmNsdWRlIGxvY2FsIGFuZCBpbnRlcm5ldFxuICBnZXRBbGxGaWxlcygpOiBJbWFnZVtdIHtcbiAgICBjb25zdCBlZGl0b3IgPSB0aGlzLmdldEVkaXRvcigpO1xuICAgIGxldCB2YWx1ZSA9IGVkaXRvci5nZXRWYWx1ZSgpO1xuICAgIHJldHVybiB0aGlzLmdldEltYWdlTGluayh2YWx1ZSk7XG4gIH1cblxuICBnZXRJbWFnZUxpbmsodmFsdWU6IHN0cmluZyk6IEltYWdlW10ge1xuICAgIGNvbnN0IG1hdGNoZXMgPSB2YWx1ZS5tYXRjaEFsbChSRUdFWF9GSUxFKTtcbiAgICBjb25zdCBXaWtpTWF0Y2hlcyA9IHZhbHVlLm1hdGNoQWxsKFJFR0VYX1dJS0lfRklMRSk7XG5cbiAgICBsZXQgZmlsZUFycmF5OiBJbWFnZVtdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IG1hdGNoIG9mIG1hdGNoZXMpIHtcbiAgICAgIGNvbnN0IHNvdXJjZSA9IG1hdGNoWzBdO1xuXG4gICAgICBsZXQgbmFtZSA9IG1hdGNoWzFdO1xuICAgICAgbGV0IHBhdGggPSBtYXRjaFsyXTtcbiAgICAgIGlmIChuYW1lID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbmFtZSA9IG1hdGNoWzNdO1xuICAgICAgfVxuICAgICAgaWYgKHBhdGggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwYXRoID0gbWF0Y2hbNF07XG4gICAgICB9XG5cbiAgICAgIGZpbGVBcnJheS5wdXNoKHtcbiAgICAgICAgcGF0aDogcGF0aCxcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgc291cmNlOiBzb3VyY2UsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IG1hdGNoIG9mIFdpa2lNYXRjaGVzKSB7XG4gICAgICBsZXQgbmFtZSA9IHBhcnNlKG1hdGNoWzFdKS5uYW1lO1xuICAgICAgY29uc3QgcGF0aCA9IG1hdGNoWzFdO1xuICAgICAgY29uc3Qgc291cmNlID0gbWF0Y2hbMF07XG4gICAgICBpZiAobWF0Y2hbMl0pIHtcbiAgICAgICAgbmFtZSA9IGAke25hbWV9JHttYXRjaFsyXX1gO1xuICAgICAgfVxuICAgICAgZmlsZUFycmF5LnB1c2goe1xuICAgICAgICBwYXRoOiBwYXRoLFxuICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICBzb3VyY2U6IHNvdXJjZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBmaWxlQXJyYXk7XG4gIH1cblxuICBoYXNCbGFja0RvbWFpbihzcmM6IHN0cmluZywgYmxhY2tEb21haW5zOiBzdHJpbmcpIHtcbiAgICBpZiAoYmxhY2tEb21haW5zLnRyaW0oKSA9PT0gXCJcIikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBibGFja0RvbWFpbkxpc3QgPSBibGFja0RvbWFpbnMuc3BsaXQoXCIsXCIpLmZpbHRlcihpdGVtID0+IGl0ZW0gIT09IFwiXCIpO1xuICAgIGxldCB1cmwgPSBuZXcgVVJMKHNyYyk7XG4gICAgY29uc3QgZG9tYWluID0gdXJsLmhvc3RuYW1lO1xuXG4gICAgcmV0dXJuIGJsYWNrRG9tYWluTGlzdC5zb21lKGJsYWNrRG9tYWluID0+IGRvbWFpbi5pbmNsdWRlcyhibGFja0RvbWFpbikpO1xuICB9XG59XG4iLCJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcsIE5vdGljZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IGltYWdlQXV0b1VwbG9hZFBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XG5pbXBvcnQgeyB0IH0gZnJvbSBcIi4vbGFuZy9oZWxwZXJzXCI7XG5pbXBvcnQgeyBnZXRPUyB9IGZyb20gXCIuL3V0aWxzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGx1Z2luU2V0dGluZ3Mge1xuICB1cGxvYWRCeUNsaXBTd2l0Y2g6IGJvb2xlYW47XG4gIHVwbG9hZFNlcnZlcjogc3RyaW5nO1xuICBkZWxldGVTZXJ2ZXI6IHN0cmluZztcbiAgaW1hZ2VTaXplU3VmZml4OiBzdHJpbmc7XG4gIHVwbG9hZGVyOiBzdHJpbmc7XG4gIHBpY2dvQ29yZVBhdGg6IHN0cmluZztcbiAgd29ya09uTmV0V29yazogYm9vbGVhbjtcbiAgbmV3V29ya0JsYWNrRG9tYWluczogc3RyaW5nO1xuICBmaXhQYXRoOiBib29sZWFuO1xuICBhcHBseUltYWdlOiBib29sZWFuO1xuICBkZWxldGVTb3VyY2U6IGJvb2xlYW47XG4gIGF1dG9DbGVhbnVwUm9vdDogYm9vbGVhbjtcbiAgaW1hZ2VEZXNjOiBcIm9yaWdpblwiIHwgXCJub25lXCIgfCBcInJlbW92ZURlZmF1bHRcIjtcbiAgcmVtb3RlU2VydmVyTW9kZTogYm9vbGVhbjtcbiAgW3Byb3BOYW1lOiBzdHJpbmddOiBhbnk7XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBQbHVnaW5TZXR0aW5ncyA9IHtcbiAgdXBsb2FkQnlDbGlwU3dpdGNoOiB0cnVlLFxuICB1cGxvYWRlcjogXCJQaWNHb1wiLFxuICB1cGxvYWRTZXJ2ZXI6IFwiaHR0cDovLzEyNy4wLjAuMTozNjY3Ny91cGxvYWRcIixcbiAgZGVsZXRlU2VydmVyOiBcImh0dHA6Ly8xMjcuMC4wLjE6MzY2NzcvZGVsZXRlXCIsXG4gIGltYWdlU2l6ZVN1ZmZpeDogXCJcIixcbiAgcGljZ29Db3JlUGF0aDogXCJcIixcbiAgd29ya09uTmV0V29yazogZmFsc2UsXG4gIGZpeFBhdGg6IGZhbHNlLFxuICBhcHBseUltYWdlOiB0cnVlLFxuICBuZXdXb3JrQmxhY2tEb21haW5zOiBcIlwiLFxuICBkZWxldGVTb3VyY2U6IGZhbHNlLFxuICBhdXRvQ2xlYW51cFJvb3Q6IHRydWUsXG4gIGltYWdlRGVzYzogXCJvcmlnaW5cIixcbiAgcmVtb3RlU2VydmVyTW9kZTogZmFsc2UsXG59O1xuXG5leHBvcnQgY2xhc3MgU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IGltYWdlQXV0b1VwbG9hZFBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBpbWFnZUF1dG9VcGxvYWRQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGxldCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXG4gICAgY29uc3Qgb3MgPSBnZXRPUygpO1xuXG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogdChcIlBsdWdpbiBTZXR0aW5nc1wiKSB9KTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKHQoXCJBdXRvIHBhc3RlZCB1cGxvYWRcIikpXG4gICAgICAuc2V0RGVzYyhcbiAgICAgICAgdChcbiAgICAgICAgICBcIklmIHlvdSBzZXQgdGhpcyB2YWx1ZSB0cnVlLCB3aGVuIHlvdSBwYXN0ZSBpbWFnZSwgaXQgd2lsbCBiZSBhdXRvIHVwbG9hZGVkKHlvdSBzaG91bGQgc2V0IHRoZSBwaWNHbyBzZXJ2ZXIgcmlnaHRseSlcIlxuICAgICAgICApXG4gICAgICApXG4gICAgICAuYWRkVG9nZ2xlKHRvZ2dsZSA9PlxuICAgICAgICB0b2dnbGVcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MudXBsb2FkQnlDbGlwU3dpdGNoKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyB2YWx1ZSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy51cGxvYWRCeUNsaXBTd2l0Y2ggPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSh0KFwiRGVmYXVsdCB1cGxvYWRlclwiKSlcbiAgICAgIC5zZXREZXNjKHQoXCJEZWZhdWx0IHVwbG9hZGVyXCIpKVxuICAgICAgLmFkZERyb3Bkb3duKGNiID0+XG4gICAgICAgIGNiXG4gICAgICAgICAgLmFkZE9wdGlvbihcIlBpY0dvXCIsIFwiUGljR28oYXBwKVwiKVxuICAgICAgICAgIC5hZGRPcHRpb24oXCJQaWNHby1Db3JlXCIsIFwiUGljR28tQ29yZVwiKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy51cGxvYWRlcilcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgdmFsdWUgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MudXBsb2FkZXIgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGxheSgpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICBpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MudXBsb2FkZXIgPT09IFwiUGljR29cIikge1xuICAgICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAgIC5zZXROYW1lKHQoXCJQaWNHbyBzZXJ2ZXJcIikpXG4gICAgICAgIC5zZXREZXNjKHQoXCJQaWNHbyBzZXJ2ZXIgZGVzY1wiKSlcbiAgICAgICAgLmFkZFRleHQodGV4dCA9PlxuICAgICAgICAgIHRleHRcbiAgICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcih0KFwiUGxlYXNlIGlucHV0IFBpY0dvIHNlcnZlclwiKSlcbiAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy51cGxvYWRTZXJ2ZXIpXG4gICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMga2V5ID0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MudXBsb2FkU2VydmVyID0ga2V5O1xuICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICk7XG5cbiAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAuc2V0TmFtZSh0KFwiUGljR28gZGVsZXRlIHNlcnZlclwiKSlcbiAgICAgICAgLnNldERlc2ModChcIlBpY0xpc3QgZGVzY1wiKSlcbiAgICAgICAgLmFkZFRleHQodGV4dCA9PlxuICAgICAgICAgIHRleHRcbiAgICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcih0KFwiUGxlYXNlIGlucHV0IFBpY0dvIGRlbGV0ZSBzZXJ2ZXJcIikpXG4gICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVsZXRlU2VydmVyKVxuICAgICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jIGtleSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmRlbGV0ZVNlcnZlciA9IGtleTtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICApO1xuICAgIH1cblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUodChcIlJlbW90ZSBzZXJ2ZXIgbW9kZVwiKSlcbiAgICAgIC5zZXREZXNjKHQoXCJSZW1vdGUgc2VydmVyIG1vZGUgZGVzY1wiKSlcbiAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5yZW1vdGVTZXJ2ZXJNb2RlKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyB2YWx1ZSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5yZW1vdGVTZXJ2ZXJNb2RlID0gdmFsdWU7XG4gICAgICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mud29ya09uTmV0V29yayA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5kaXNwbGF5KCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy51cGxvYWRlciA9PT0gXCJQaWNHby1Db3JlXCIpIHtcbiAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAuc2V0TmFtZSh0KFwiUGljR28tQ29yZSBwYXRoXCIpKVxuICAgICAgICAuc2V0RGVzYyhcbiAgICAgICAgICB0KFwiUGxlYXNlIGlucHV0IFBpY0dvLUNvcmUgcGF0aCwgZGVmYXVsdCB1c2luZyBlbnZpcm9ubWVudCB2YXJpYWJsZXNcIilcbiAgICAgICAgKVxuICAgICAgICAuYWRkVGV4dCh0ZXh0ID0+XG4gICAgICAgICAgdGV4dFxuICAgICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiXCIpXG4gICAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucGljZ29Db3JlUGF0aClcbiAgICAgICAgICAgIC5vbkNoYW5nZShhc3luYyB2YWx1ZSA9PiB7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnBpY2dvQ29yZVBhdGggPSB2YWx1ZTtcbiAgICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICApO1xuXG4gICAgICBpZiAob3MgIT09IFwiV2luZG93c1wiKSB7XG4gICAgICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgICAgIC5zZXROYW1lKHQoXCJmaXhQYXRoXCIpKVxuICAgICAgICAgIC5zZXREZXNjKHQoXCJmaXhQYXRoV2FybmluZ1wiKSlcbiAgICAgICAgICAuYWRkVG9nZ2xlKHRvZ2dsZSA9PlxuICAgICAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5maXhQYXRoKVxuICAgICAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgdmFsdWUgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmZpeFBhdGggPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGltYWdlIGRlc2Mgc2V0dGluZ1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUodChcIkltYWdlIGRlc2NcIikpXG4gICAgICAuc2V0RGVzYyh0KFwiSW1hZ2UgZGVzY1wiKSlcbiAgICAgIC5hZGREcm9wZG93bihjYiA9PlxuICAgICAgICBjYlxuICAgICAgICAgIC5hZGRPcHRpb24oXCJvcmlnaW5cIiwgdChcInJlc2VydmVcIikpIC8vIOS/neeVmeWFqOmDqFxuICAgICAgICAgIC5hZGRPcHRpb24oXCJub25lXCIsIHQoXCJyZW1vdmUgYWxsXCIpKSAvLyDnp7vpmaTlhajpg6hcbiAgICAgICAgICAuYWRkT3B0aW9uKFwicmVtb3ZlRGVmYXVsdFwiLCB0KFwicmVtb3ZlIGRlZmF1bHRcIikpIC8vIOWPquenu+mZpOm7mOiupOWNsyBpbWFnZS5wbmdcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuaW1hZ2VEZXNjKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWU6IFwib3JpZ2luXCIgfCBcIm5vbmVcIiB8IFwicmVtb3ZlRGVmYXVsdFwiKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbWFnZURlc2MgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGxheSgpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKHQoXCJJbWFnZSBzaXplIHN1ZmZpeFwiKSlcbiAgICAgIC5zZXREZXNjKHQoXCJJbWFnZSBzaXplIHN1ZmZpeCBEZXNjcmlwdGlvblwiKSlcbiAgICAgIC5hZGRUZXh0KHRleHQgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcih0KFwiUGxlYXNlIGlucHV0IGltYWdlIHNpemUgc3VmZml4XCIpKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbWFnZVNpemVTdWZmaXgpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jIGtleSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5pbWFnZVNpemVTdWZmaXggPSBrZXk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUodChcIldvcmsgb24gbmV0d29ya1wiKSlcbiAgICAgIC5zZXREZXNjKHQoXCJXb3JrIG9uIG5ldHdvcmsgRGVzY3JpcHRpb25cIikpXG4gICAgICAuYWRkVG9nZ2xlKHRvZ2dsZSA9PlxuICAgICAgICB0b2dnbGVcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Mud29ya09uTmV0V29yaylcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgdmFsdWUgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMucGx1Z2luLnNldHRpbmdzLnJlbW90ZVNlcnZlck1vZGUpIHtcbiAgICAgICAgICAgICAgbmV3IE5vdGljZShcIkNhbiBvbmx5IHdvcmsgd2hlbiByZW1vdGUgc2VydmVyIG1vZGUgaXMgb2ZmLlwiKTtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mud29ya09uTmV0V29yayA9IGZhbHNlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mud29ya09uTmV0V29yayA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5kaXNwbGF5KCk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUodChcIk5ldHdvcmsgRG9tYWluIEJsYWNrIExpc3RcIikpXG4gICAgICAuc2V0RGVzYyh0KFwiTmV0d29yayBEb21haW4gQmxhY2sgTGlzdCBEZXNjcmlwdGlvblwiKSlcbiAgICAgIC5hZGRUZXh0QXJlYSh0ZXh0QXJlYSA9PlxuICAgICAgICB0ZXh0QXJlYVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5uZXdXb3JrQmxhY2tEb21haW5zKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyB2YWx1ZSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5uZXdXb3JrQmxhY2tEb21haW5zID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUodChcIlVwbG9hZCB3aGVuIGNsaXBib2FyZCBoYXMgaW1hZ2UgYW5kIHRleHQgdG9nZXRoZXJcIikpXG4gICAgICAuc2V0RGVzYyhcbiAgICAgICAgdChcbiAgICAgICAgICBcIldoZW4geW91IGNvcHksIHNvbWUgYXBwbGljYXRpb24gbGlrZSBFeGNlbCB3aWxsIGltYWdlIGFuZCB0ZXh0IHRvIGNsaXBib2FyZCwgeW91IGNhbiB1cGxvYWQgb3Igbm90LlwiXG4gICAgICAgIClcbiAgICAgIClcbiAgICAgIC5hZGRUb2dnbGUodG9nZ2xlID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcHBseUltYWdlKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyB2YWx1ZSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hcHBseUltYWdlID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLmRpc3BsYXkoKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZSh0KFwiRGVsZXRlIHNvdXJjZSBmaWxlIGFmdGVyIHlvdSB1cGxvYWQgZmlsZVwiKSlcbiAgICAgIC5zZXREZXNjKHQoXCJEZWxldGUgc291cmNlIGZpbGUgaW4gb2IgYXNzZXRzIGFmdGVyIHlvdSB1cGxvYWQgZmlsZS5cIikpXG4gICAgICAuYWRkVG9nZ2xlKHRvZ2dsZSA9PlxuICAgICAgICB0b2dnbGVcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVsZXRlU291cmNlKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyB2YWx1ZSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWxldGVTb3VyY2UgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGxheSgpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwi6Ieq5Yqo5riF55CG5qC555uu5b2V6ZmE5Lu2XCIpXG4gICAgICAuc2V0RGVzYyhcIuavjyAzMCDliIbpkp/miavmj4/moLnnm67lvZXkuK3nmoTlm77niYflkozpn7Pop4bpopHmlofku7bvvIzkuIrkvKDlkI7mm7/mjaLpk77mjqXlubbliKDpmaTmnKzlnLDmupDmlofku7bjgIJcIilcbiAgICAgIC5hZGRCdXR0b24oYnV0dG9uID0+XG4gICAgICAgIGJ1dHRvbi5zZXRCdXR0b25UZXh0KFwi56uL5Y2z5omn6KGMXCIpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLmNsZWFudXBSb290QXNzZXRzV2l0aE5vdGljZSgpO1xuICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLmFkZFRvZ2dsZSh0b2dnbGUgPT5cbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9DbGVhbnVwUm9vdClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgdmFsdWUgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b0NsZWFudXBSb290ID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcbiAgfVxufVxuIiwiaW1wb3J0IHtcbiAgTWFya2Rvd25WaWV3LFxuICBQbHVnaW4sXG4gIEZpbGVTeXN0ZW1BZGFwdGVyLFxuICBFZGl0b3IsXG4gIE1lbnUsXG4gIE1lbnVJdGVtLFxuICBURmlsZSxcbiAgbm9ybWFsaXplUGF0aCxcbiAgTm90aWNlLFxuICBhZGRJY29uLFxuICBNYXJrZG93bkZpbGVJbmZvLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IHJlc29sdmUsIHJlbGF0aXZlLCBqb2luLCBiYXNlbmFtZSwgZGlybmFtZSB9IGZyb20gXCJwYXRoLWJyb3dzZXJpZnlcIjtcbmltcG9ydCB7IGV4aXN0c1N5bmMsIHVubGluayB9IGZyb20gXCJmc1wiO1xuaW1wb3J0IGZpeFBhdGggZnJvbSBcImZpeC1wYXRoXCI7XG5cbmltcG9ydCB7IGlzQXNzZXRUeXBlQW5Bc3NldCwgYXJyYXlUb09iamVjdCwgZ2V0RW1iZWRNYXJrZG93biB9IGZyb20gXCIuL3V0aWxzXCI7XG5pbXBvcnQgeyBkb3dubG9hZEFsbEltYWdlRmlsZXMgfSBmcm9tIFwiLi9kb3dubG9hZFwiO1xuaW1wb3J0IHsgUGljR29VcGxvYWRlciwgUGljR29Db3JlVXBsb2FkZXIgfSBmcm9tIFwiLi91cGxvYWRlclwiO1xuaW1wb3J0IHsgUGljR29EZWxldGVyIH0gZnJvbSBcIi4vZGVsZXRlclwiO1xuaW1wb3J0IEhlbHBlciBmcm9tIFwiLi9oZWxwZXJcIjtcbmltcG9ydCB7IHQgfSBmcm9tIFwiLi9sYW5nL2hlbHBlcnNcIjtcblxuaW1wb3J0IHsgU2V0dGluZ1RhYiwgUGx1Z2luU2V0dGluZ3MsIERFRkFVTFRfU0VUVElOR1MgfSBmcm9tIFwiLi9zZXR0aW5nXCI7XG5cbmludGVyZmFjZSBJbWFnZSB7XG4gIHBhdGg6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICBzb3VyY2U6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIENsZWFudXBSb290QXNzZXRzUmVzdWx0IHtcbiAgc2Nhbm5lZDogbnVtYmVyO1xuICB1cGxvYWRlZDogbnVtYmVyO1xuICByZXBsYWNlZDogbnVtYmVyO1xuICBkZWxldGVkOiBudW1iZXI7XG4gIGZhaWxlZDogc3RyaW5nW107XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIGltYWdlQXV0b1VwbG9hZFBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIHNldHRpbmdzOiBQbHVnaW5TZXR0aW5ncztcbiAgaGVscGVyOiBIZWxwZXI7XG4gIGVkaXRvcjogRWRpdG9yO1xuICBwaWNHb1VwbG9hZGVyOiBQaWNHb1VwbG9hZGVyO1xuICBwaWNHb0RlbGV0ZXI6IFBpY0dvRGVsZXRlcjtcbiAgcGljR29Db3JlVXBsb2FkZXI6IFBpY0dvQ29yZVVwbG9hZGVyO1xuICB1cGxvYWRlcjogUGljR29VcGxvYWRlciB8IFBpY0dvQ29yZVVwbG9hZGVyO1xuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbihERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCkge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cblxuICBvbnVubG9hZCgpIHt9XG5cbiAgYXN5bmMgb25sb2FkKCkge1xuICAgIGF3YWl0IHRoaXMubG9hZFNldHRpbmdzKCk7XG5cbiAgICB0aGlzLmhlbHBlciA9IG5ldyBIZWxwZXIodGhpcy5hcHApO1xuICAgIHRoaXMucGljR29VcGxvYWRlciA9IG5ldyBQaWNHb1VwbG9hZGVyKHRoaXMuc2V0dGluZ3MsIHRoaXMpO1xuICAgIHRoaXMucGljR29EZWxldGVyID0gbmV3IFBpY0dvRGVsZXRlcih0aGlzKTtcbiAgICB0aGlzLnBpY0dvQ29yZVVwbG9hZGVyID0gbmV3IFBpY0dvQ29yZVVwbG9hZGVyKHRoaXMuc2V0dGluZ3MsIHRoaXMpO1xuXG4gICAgaWYgKHRoaXMuc2V0dGluZ3MudXBsb2FkZXIgPT09IFwiUGljR29cIikge1xuICAgICAgdGhpcy51cGxvYWRlciA9IHRoaXMucGljR29VcGxvYWRlcjtcbiAgICB9IGVsc2UgaWYgKHRoaXMuc2V0dGluZ3MudXBsb2FkZXIgPT09IFwiUGljR28tQ29yZVwiKSB7XG4gICAgICB0aGlzLnVwbG9hZGVyID0gdGhpcy5waWNHb0NvcmVVcGxvYWRlcjtcbiAgICAgIGlmICh0aGlzLnNldHRpbmdzLmZpeFBhdGgpIHtcbiAgICAgICAgZml4UGF0aCgpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBuZXcgTm90aWNlKFwidW5rbm93biB1cGxvYWRlclwiKTtcbiAgICB9XG5cbiAgICBhZGRJY29uKFxuICAgICAgXCJ1cGxvYWRcIixcbiAgICAgIGA8c3ZnIHQ9XCIxNjM2NjMwNzgzNDI5XCIgY2xhc3M9XCJpY29uXCIgdmlld0JveD1cIjAgMCAxMDAgMTAwXCIgdmVyc2lvbj1cIjEuMVwiIHAtaWQ9XCI0NjQ5XCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPlxuICAgICAgPHBhdGggZD1cIk0gNzEuNjM4IDM1LjMzNiBMIDc5LjQwOCAzNS4zMzYgQyA4My43IDM1LjMzNiA4Ny4xNzggMzguNjYyIDg3LjE3OCA0Mi43NjUgTCA4Ny4xNzggODQuODY0IEMgODcuMTc4IDg4Ljk2OSA4My43IDkyLjI5NSA3OS40MDggOTIuMjk1IEwgMTcuMjQ5IDkyLjI5NSBDIDEyLjk1NyA5Mi4yOTUgOS40NzkgODguOTY5IDkuNDc5IDg0Ljg2NCBMIDkuNDc5IDQyLjc2NSBDIDkuNDc5IDM4LjY2MiAxMi45NTcgMzUuMzM2IDE3LjI0OSAzNS4zMzYgTCAyNS4wMTkgMzUuMzM2IEwgMjUuMDE5IDQyLjc2NSBMIDE3LjI0OSA0Mi43NjUgTCAxNy4yNDkgODQuODY0IEwgNzkuNDA4IDg0Ljg2NCBMIDc5LjQwOCA0Mi43NjUgTCA3MS42MzggNDIuNzY1IEwgNzEuNjM4IDM1LjMzNiBaIE0gNDkuMDE0IDEwLjE3OSBMIDY3LjMyNiAyNy42ODggTCA2MS44MzUgMzIuOTQyIEwgNTIuODQ5IDI0LjM1MiBMIDUyLjg0OSA1OS43MzEgTCA0NS4wNzggNTkuNzMxIEwgNDUuMDc4IDI0LjQ1NSBMIDM2LjE5NCAzMi45NDcgTCAzMC43MDIgMjcuNjkyIEwgNDkuMDEyIDEwLjE4MSBaXCIgcC1pZD1cIjQ2NTBcIiBmaWxsPVwiIzhhOGE4YVwiPjwvcGF0aD5cbiAgICA8L3N2Zz5gXG4gICAgKTtcblxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIlVwbG9hZCBhbGwgaW1hZ2VzXCIsXG4gICAgICBuYW1lOiBcIlVwbG9hZCBhbGwgaW1hZ2VzXCIsXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgbGV0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZjtcbiAgICAgICAgaWYgKGxlYWYpIHtcbiAgICAgICAgICBpZiAoIWNoZWNraW5nKSB7XG4gICAgICAgICAgICB0aGlzLnVwbG9hZEFsbEZpbGUoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSxcbiAgICB9KTtcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiRG93bmxvYWQgYWxsIGltYWdlc1wiLFxuICAgICAgbmFtZTogXCJEb3dubG9hZCBhbGwgaW1hZ2VzXCIsXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgbGV0IGxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuYWN0aXZlTGVhZjtcbiAgICAgICAgaWYgKGxlYWYpIHtcbiAgICAgICAgICBpZiAoIWNoZWNraW5nKSB7XG4gICAgICAgICAgICBkb3dubG9hZEFsbEltYWdlRmlsZXModGhpcyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLnNldHVwUGFzdGVIYW5kbGVyKCk7XG4gICAgdGhpcy5yZWdpc3RlckZpbGVNZW51KCk7XG4gICAgdGhpcy5yZWdpc3RlckludGVydmFsKFxuICAgICAgd2luZG93LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3MuYXV0b0NsZWFudXBSb290KSB7XG4gICAgICAgICAgdGhpcy5jbGVhbnVwUm9vdEFzc2V0cygpLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJBdXRvIGNsZWFudXAgcm9vdCBhc3NldHMgZmFpbGVkOiBcIiwgZXJyb3IpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LCAzMCAqIDYwICogMTAwMClcbiAgICApO1xuXG4gICAgdGhpcy5yZWdpc3RlclNlbGVjdGlvbigpO1xuICB9XG5cbiAgcmVnaXN0ZXJTZWxlY3Rpb24oKSB7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFxuICAgICAgICBcImVkaXRvci1tZW51XCIsXG4gICAgICAgIChtZW51OiBNZW51LCBlZGl0b3I6IEVkaXRvciwgaW5mbzogTWFya2Rvd25WaWV3IHwgTWFya2Rvd25GaWxlSW5mbykgPT4ge1xuICAgICAgICAgIGlmICh0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFwibWFya2Rvd25cIikubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHNlbGVjdGlvbiA9IGVkaXRvci5nZXRTZWxlY3Rpb24oKTtcbiAgICAgICAgICBpZiAoc2VsZWN0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBtYXJrZG93blJlZ2V4ID0gLyFcXFsuKlxcXVxcKCguKilcXCkvZztcbiAgICAgICAgICAgIGNvbnN0IG1hcmtkb3duTWF0Y2ggPSBtYXJrZG93blJlZ2V4LmV4ZWMoc2VsZWN0aW9uKTtcbiAgICAgICAgICAgIGlmIChtYXJrZG93bk1hdGNoICYmIG1hcmtkb3duTWF0Y2gubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICBjb25zdCBtYXJrZG93blVybCA9IG1hcmtkb3duTWF0Y2hbMV07XG4gICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICB0aGlzLnNldHRpbmdzLnVwbG9hZGVkSW1hZ2VzLmZpbmQoXG4gICAgICAgICAgICAgICAgICAoaXRlbTogeyBpbWdVcmw6IHN0cmluZyB9KSA9PiBpdGVtLmltZ1VybCA9PT0gbWFya2Rvd25VcmxcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTWVudShtZW51LCBtYXJrZG93blVybCwgZWRpdG9yKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgKVxuICAgICk7XG4gIH1cblxuICBhZGRNZW51ID0gKG1lbnU6IE1lbnUsIGltZ1BhdGg6IHN0cmluZywgZWRpdG9yOiBFZGl0b3IpID0+IHtcbiAgICBtZW51LmFkZEl0ZW0oKGl0ZW06IE1lbnVJdGVtKSA9PlxuICAgICAgaXRlbVxuICAgICAgICAuc2V0SWNvbihcInRyYXNoLTJcIilcbiAgICAgICAgLnNldFRpdGxlKHQoXCJEZWxldGUgaW1hZ2UgdXNpbmcgUGljTGlzdFwiKSlcbiAgICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBzZWxlY3RlZEl0ZW0gPSB0aGlzLnNldHRpbmdzLnVwbG9hZGVkSW1hZ2VzLmZpbmQoXG4gICAgICAgICAgICAgIChpdGVtOiB7IGltZ1VybDogc3RyaW5nIH0pID0+IGl0ZW0uaW1nVXJsID09PSBpbWdQYXRoXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKHNlbGVjdGVkSXRlbSkge1xuICAgICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLnBpY0dvRGVsZXRlci5kZWxldGVJbWFnZShbc2VsZWN0ZWRJdGVtXSk7XG4gICAgICAgICAgICAgIGlmIChyZXMuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIG5ldyBOb3RpY2UodChcIkRlbGV0ZSBzdWNjZXNzZnVsbHlcIikpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlbGVjdGlvbiA9IGVkaXRvci5nZXRTZWxlY3Rpb24oKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICBlZGl0b3IucmVwbGFjZVNlbGVjdGlvbihcIlwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy51cGxvYWRlZEltYWdlcyA9XG4gICAgICAgICAgICAgICAgICB0aGlzLnNldHRpbmdzLnVwbG9hZGVkSW1hZ2VzLmZpbHRlcihcbiAgICAgICAgICAgICAgICAgICAgKGl0ZW06IHsgaW1nVXJsOiBzdHJpbmcgfSkgPT4gaXRlbS5pbWdVcmwgIT09IGltZ1BhdGhcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgdGhpcy5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZXcgTm90aWNlKHQoXCJEZWxldGUgZmFpbGVkXCIpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgbmV3IE5vdGljZSh0KFwiRXJyb3IsIGNvdWxkIG5vdCBkZWxldGVcIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICApO1xuICB9O1xuXG4gIHJlZ2lzdGVyRmlsZU1lbnUoKSB7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFxuICAgICAgICBcImZpbGUtbWVudVwiLFxuICAgICAgICAobWVudTogTWVudSwgZmlsZTogVEZpbGUsIHNvdXJjZTogc3RyaW5nLCBsZWFmKSA9PiB7XG4gICAgICAgICAgaWYgKHNvdXJjZSA9PT0gXCJjYW52YXMtbWVudVwiKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgaWYgKCFpc0Fzc2V0VHlwZUFuQXNzZXQoZmlsZS5wYXRoKSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgICAgbWVudS5hZGRJdGVtKChpdGVtOiBNZW51SXRlbSkgPT4ge1xuICAgICAgICAgICAgaXRlbVxuICAgICAgICAgICAgICAuc2V0VGl0bGUoXCJVcGxvYWRcIilcbiAgICAgICAgICAgICAgLnNldEljb24oXCJ1cGxvYWRcIilcbiAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5maWxlTWVudVVwbG9hZChmaWxlKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIClcbiAgICApO1xuICB9XG5cbiAgZmlsZU1lbnVVcGxvYWQoZmlsZTogVEZpbGUpIHtcbiAgICBsZXQgY29udGVudCA9IHRoaXMuaGVscGVyLmdldFZhbHVlKCk7XG5cbiAgICBjb25zdCBiYXNlUGF0aCA9IChcbiAgICAgIHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIgYXMgRmlsZVN5c3RlbUFkYXB0ZXJcbiAgICApLmdldEJhc2VQYXRoKCk7XG4gICAgbGV0IGltYWdlTGlzdDogSW1hZ2VbXSA9IFtdO1xuICAgIGNvbnN0IGZpbGVBcnJheSA9IHRoaXMuaGVscGVyLmdldEFsbEZpbGVzKCk7XG5cbiAgICBmb3IgKGNvbnN0IG1hdGNoIG9mIGZpbGVBcnJheSkge1xuICAgICAgY29uc3QgaW1hZ2VOYW1lID0gbWF0Y2gubmFtZTtcbiAgICAgIGNvbnN0IGVuY29kZWRVcmkgPSBtYXRjaC5wYXRoO1xuXG4gICAgICBjb25zdCBmaWxlTmFtZSA9IGJhc2VuYW1lKGRlY29kZVVSSShlbmNvZGVkVXJpKSk7XG5cbiAgICAgIGlmIChmaWxlICYmIGZpbGUubmFtZSA9PT0gZmlsZU5hbWUpIHtcbiAgICAgICAgY29uc3QgYWJzdHJhY3RJbWFnZUZpbGUgPSBqb2luKGJhc2VQYXRoLCBmaWxlLnBhdGgpO1xuXG4gICAgICAgIGlmIChpc0Fzc2V0VHlwZUFuQXNzZXQoYWJzdHJhY3RJbWFnZUZpbGUpKSB7XG4gICAgICAgICAgaW1hZ2VMaXN0LnB1c2goe1xuICAgICAgICAgICAgcGF0aDogYWJzdHJhY3RJbWFnZUZpbGUsXG4gICAgICAgICAgICBuYW1lOiBpbWFnZU5hbWUsXG4gICAgICAgICAgICBzb3VyY2U6IG1hdGNoLnNvdXJjZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChpbWFnZUxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICBuZXcgTm90aWNlKHQoXCJDYW4gbm90IGZpbmQgaW1hZ2UgZmlsZVwiKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy51cGxvYWRlci51cGxvYWRGaWxlcyhpbWFnZUxpc3QubWFwKGl0ZW0gPT4gaXRlbS5wYXRoKSkudGhlbihyZXMgPT4ge1xuICAgICAgaWYgKHJlcy5zdWNjZXNzKSB7XG4gICAgICAgIGxldCB1cGxvYWRVcmxMaXN0ID0gcmVzLnJlc3VsdDtcbiAgICAgICAgaW1hZ2VMaXN0Lm1hcChpdGVtID0+IHtcbiAgICAgICAgICBjb25zdCB1cGxvYWRJbWFnZSA9IHVwbG9hZFVybExpc3Quc2hpZnQoKTtcbiAgICAgICAgICBsZXQgbmFtZSA9IHRoaXMuaGFuZGxlTmFtZShpdGVtLm5hbWUpO1xuXG4gICAgICAgICAgY29udGVudCA9IGNvbnRlbnQucmVwbGFjZUFsbChcbiAgICAgICAgICAgIGl0ZW0uc291cmNlLFxuICAgICAgICAgICAgZ2V0RW1iZWRNYXJrZG93bihpdGVtLm5hbWUsIHVwbG9hZEltYWdlLCBuYW1lKVxuICAgICAgICAgICk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmhlbHBlci5zZXRWYWx1ZShjb250ZW50KTtcblxuICAgICAgICBpZiAodGhpcy5zZXR0aW5ncy5kZWxldGVTb3VyY2UpIHtcbiAgICAgICAgICBpbWFnZUxpc3QubWFwKGltYWdlID0+IHtcbiAgICAgICAgICAgIGlmICghaW1hZ2UucGF0aC5zdGFydHNXaXRoKFwiaHR0cFwiKSkge1xuICAgICAgICAgICAgICB1bmxpbmsoaW1hZ2UucGF0aCwgKCkgPT4ge30pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXcgTm90aWNlKFwiVXBsb2FkIGVycm9yXCIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZmlsdGVyRmlsZShmaWxlQXJyYXk6IEltYWdlW10pIHtcbiAgICBjb25zdCBpbWFnZUxpc3Q6IEltYWdlW10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgbWF0Y2ggb2YgZmlsZUFycmF5KSB7XG4gICAgICBpZiAobWF0Y2gucGF0aC5zdGFydHNXaXRoKFwiaHR0cFwiKSkge1xuICAgICAgICBpZiAodGhpcy5zZXR0aW5ncy53b3JrT25OZXRXb3JrKSB7XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgIXRoaXMuaGVscGVyLmhhc0JsYWNrRG9tYWluKFxuICAgICAgICAgICAgICBtYXRjaC5wYXRoLFxuICAgICAgICAgICAgICB0aGlzLnNldHRpbmdzLm5ld1dvcmtCbGFja0RvbWFpbnNcbiAgICAgICAgICAgIClcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIGltYWdlTGlzdC5wdXNoKHtcbiAgICAgICAgICAgICAgcGF0aDogbWF0Y2gucGF0aCxcbiAgICAgICAgICAgICAgbmFtZTogbWF0Y2gubmFtZSxcbiAgICAgICAgICAgICAgc291cmNlOiBtYXRjaC5zb3VyY2UsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGltYWdlTGlzdC5wdXNoKHtcbiAgICAgICAgICBwYXRoOiBtYXRjaC5wYXRoLFxuICAgICAgICAgIG5hbWU6IG1hdGNoLm5hbWUsXG4gICAgICAgICAgc291cmNlOiBtYXRjaC5zb3VyY2UsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBpbWFnZUxpc3Q7XG4gIH1cbiAgZ2V0RmlsZShmaWxlTmFtZTogc3RyaW5nLCBmaWxlTWFwOiBhbnkpIHtcbiAgICBpZiAoIWZpbGVNYXApIHtcbiAgICAgIGZpbGVNYXAgPSBhcnJheVRvT2JqZWN0KHRoaXMuYXBwLnZhdWx0LmdldEZpbGVzKCksIFwibmFtZVwiKTtcbiAgICB9XG4gICAgcmV0dXJuIGZpbGVNYXBbZmlsZU5hbWVdO1xuICB9XG5cbiAgYXN5bmMgY2xlYW51cFJvb3RBc3NldHMoKTogUHJvbWlzZTxDbGVhbnVwUm9vdEFzc2V0c1Jlc3VsdD4ge1xuICAgIGNvbnN0IHJlc3VsdDogQ2xlYW51cFJvb3RBc3NldHNSZXN1bHQgPSB7XG4gICAgICBzY2FubmVkOiAwLFxuICAgICAgdXBsb2FkZWQ6IDAsXG4gICAgICByZXBsYWNlZDogMCxcbiAgICAgIGRlbGV0ZWQ6IDAsXG4gICAgICBmYWlsZWQ6IFtdLFxuICAgIH07XG4gICAgY29uc3QgYmFzZVBhdGggPSAoXG4gICAgICB0aGlzLmFwcC52YXVsdC5hZGFwdGVyIGFzIEZpbGVTeXN0ZW1BZGFwdGVyXG4gICAgKS5nZXRCYXNlUGF0aCgpO1xuICAgIGNvbnN0IHJvb3RBc3NldHMgPSB0aGlzLmFwcC52YXVsdFxuICAgICAgLmdldEZpbGVzKClcbiAgICAgIC5maWx0ZXIoZmlsZSA9PiBmaWxlLnBhdGggPT09IGZpbGUubmFtZSAmJiBpc0Fzc2V0VHlwZUFuQXNzZXQoZmlsZS5wYXRoKSk7XG4gICAgcmVzdWx0LnNjYW5uZWQgPSByb290QXNzZXRzLmxlbmd0aDtcblxuICAgIGZvciAoY29uc3QgZmlsZSBvZiByb290QXNzZXRzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB1cGxvYWRSZXN1bHQgPSBhd2FpdCB0aGlzLnVwbG9hZGVyLnVwbG9hZEZpbGVzKFtcbiAgICAgICAgICBqb2luKGJhc2VQYXRoLCBmaWxlLnBhdGgpLFxuICAgICAgICBdKTtcblxuICAgICAgICBpZiAoXG4gICAgICAgICAgIXVwbG9hZFJlc3VsdC5zdWNjZXNzIHx8XG4gICAgICAgICAgIXVwbG9hZFJlc3VsdC5yZXN1bHQgfHxcbiAgICAgICAgICB1cGxvYWRSZXN1bHQucmVzdWx0Lmxlbmd0aCA9PT0gMFxuICAgICAgICApIHtcbiAgICAgICAgICByZXN1bHQuZmFpbGVkLnB1c2goYCR7ZmlsZS5uYW1lfTog5LiK5Lyg5aSx6LSlICR7dXBsb2FkUmVzdWx0Lm1zZyB8fCBcIlwifWAudHJpbSgpKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlc3VsdC51cGxvYWRlZCsrO1xuICAgICAgICBjb25zdCB1cGxvYWRVcmwgPSB0aGlzLmdldFVwbG9hZFVybCh1cGxvYWRSZXN1bHQucmVzdWx0WzBdKTtcbiAgICAgICAgY29uc29sZS5sb2coXCJBdXRvIGNsZWFudXAgcm9vdCBhc3NldCB1cGxvYWRlZCBVUkw6IFwiLCB1cGxvYWRVcmwpO1xuXG4gICAgICAgIGlmICghdXBsb2FkVXJsKSB7XG4gICAgICAgICAgcmVzdWx0LmZhaWxlZC5wdXNoKGAke2ZpbGUubmFtZX06IOS4iuS8oOaIkOWKn+S9huayoeacieaLv+WIsOi/nOeoiyBVUkxgKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlcGxhY2VkID0gYXdhaXQgdGhpcy5yZXBsYWNlUm9vdEFzc2V0TGlua3MoZmlsZSwgdXBsb2FkVXJsKTtcblxuICAgICAgICBpZiAocmVwbGFjZWQgPT09IDApIHtcbiAgICAgICAgICByZXN1bHQuZmFpbGVkLnB1c2goYCR7ZmlsZS5uYW1lfTog5LiK5Lyg5oiQ5Yqf77yM5L2G5rKh5pyJ5Zyo56yU6K6w5paH5Lu25Lit5om+5Yiw5byV55So77yM5bey5L+d55WZ5pys5Zyw5paH5Lu2YCk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXN1bHQucmVwbGFjZWQgKz0gcmVwbGFjZWQ7XG4gICAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmRlbGV0ZShmaWxlKTtcbiAgICAgICAgcmVzdWx0LmRlbGV0ZWQrKztcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnN0IHJlYXNvbiA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICAgICAgcmVzdWx0LmZhaWxlZC5wdXNoKGAke2ZpbGUubmFtZX06ICR7cmVhc29ufWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBhc3luYyBjbGVhbnVwUm9vdEFzc2V0c1dpdGhOb3RpY2UoKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jbGVhbnVwUm9vdEFzc2V0cygpO1xuXG4gICAgaWYgKHJlc3VsdC5zY2FubmVkID09PSAwKSB7XG4gICAgICBuZXcgTm90aWNlKFwi5qC555uu5b2V5riF55CG77ya5rKh5pyJ5om+5Yiw6ZyA6KaB5LiK5Lyg55qE5Zu+54mH5oiW6Z+z6KeG6aKR5paH5Lu244CCXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHN1bW1hcnkgPSBg5qC555uu5b2V5riF55CG5a6M5oiQ77ya5omr5o+PICR7cmVzdWx0LnNjYW5uZWR9IOS4qu+8jOS4iuS8oCAke3Jlc3VsdC51cGxvYWRlZH0g5Liq77yM5pu/5o2iICR7cmVzdWx0LnJlcGxhY2VkfSDlpITvvIzliKDpmaQgJHtyZXN1bHQuZGVsZXRlZH0g5Liq44CCYDtcblxuICAgIGlmIChyZXN1bHQuZmFpbGVkLmxlbmd0aCA9PT0gMCkge1xuICAgICAgbmV3IE5vdGljZShzdW1tYXJ5KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBuZXcgTm90aWNlKGAke3N1bW1hcnl9XFxu5pyq5a6M5oiQ77yaJHtyZXN1bHQuZmFpbGVkLnNsaWNlKDAsIDMpLmpvaW4oXCLvvJtcIil9YCk7XG4gIH1cblxuICBnZXRVcGxvYWRVcmwocmVzdWx0OiBhbnkpIHtcbiAgICBpZiAodHlwZW9mIHJlc3VsdCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBpZiAocmVzdWx0ICYmIHR5cGVvZiByZXN1bHQgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgIHJldHVybiByZXN1bHQuaW1nVXJsIHx8IHJlc3VsdC51cmwgfHwgcmVzdWx0LnBhdGggfHwgXCJcIjtcbiAgICB9XG5cbiAgICByZXR1cm4gXCJcIjtcbiAgfVxuXG4gIGFzeW5jIHJlcGxhY2VSb290QXNzZXRMaW5rcyhmaWxlOiBURmlsZSwgdXJsOiBzdHJpbmcpIHtcbiAgICBsZXQgcmVwbGFjZWQgPSAwO1xuXG4gICAgZm9yIChjb25zdCBub3RlRmlsZSBvZiB0aGlzLmFwcC52YXVsdC5nZXRGaWxlcygpLmZpbHRlcih0aGlzLmlzUmVmZXJlbmNlRmlsZSkpIHtcbiAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKG5vdGVGaWxlKTtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG5vdGVGaWxlLmV4dGVuc2lvbiA9PT0gXCJjYW52YXNcIlxuICAgICAgICA/IHRoaXMucmVwbGFjZUNhbnZhc0Fzc2V0TGlua3MoY29udGVudCwgZmlsZSwgdXJsKVxuICAgICAgICA6IHRoaXMucmVwbGFjZUFzc2V0TGlua3MoY29udGVudCwgZmlsZSwgdXJsKTtcblxuICAgICAgaWYgKHJlc3VsdC5jb250ZW50ICE9PSBjb250ZW50KSB7XG4gICAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShub3RlRmlsZSwgcmVzdWx0LmNvbnRlbnQpO1xuICAgICAgICByZXBsYWNlZCArPSByZXN1bHQucmVwbGFjZWQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcGxhY2VkO1xuICB9XG5cbiAgaXNSZWZlcmVuY2VGaWxlKGZpbGU6IFRGaWxlKSB7XG4gICAgcmV0dXJuIFtcIm1kXCIsIFwiY2FudmFzXCIsIFwiaHRtbFwiXS5pbmNsdWRlcyhmaWxlLmV4dGVuc2lvbik7XG4gIH1cblxuICBpc1NhbWVSb290QXNzZXQodGFyZ2V0OiBzdHJpbmcsIGZpbGU6IFRGaWxlKSB7XG4gICAgbGV0IHBhdGggPSB0YXJnZXQudHJpbSgpO1xuXG4gICAgaWYgKHBhdGguc3RhcnRzV2l0aChcIjxcIikgJiYgcGF0aC5lbmRzV2l0aChcIj5cIikpIHtcbiAgICAgIHBhdGggPSBwYXRoLnNsaWNlKDEsIC0xKTtcbiAgICB9XG4gICAgaWYgKFxuICAgICAgKHBhdGguc3RhcnRzV2l0aCgnXCInKSAmJiBwYXRoLmVuZHNXaXRoKCdcIicpKSB8fFxuICAgICAgKHBhdGguc3RhcnRzV2l0aChcIidcIikgJiYgcGF0aC5lbmRzV2l0aChcIidcIikpXG4gICAgKSB7XG4gICAgICBwYXRoID0gcGF0aC5zbGljZSgxLCAtMSk7XG4gICAgfVxuXG4gICAgcGF0aCA9IHBhdGguc3BsaXQoXCIjXCIpWzBdLnNwbGl0KFwiP1wiKVswXTtcblxuICAgIHRyeSB7XG4gICAgICBwYXRoID0gZGVjb2RlVVJJKHBhdGgpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmICgvXlthLXpdW2EtejAtOSsuLV0qOi9pLnRlc3QocGF0aCkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBjb25zdCBub3JtYWxpemVkUGF0aCA9IG5vcm1hbGl6ZVBhdGgocGF0aCk7XG5cbiAgICByZXR1cm4gbm9ybWFsaXplZFBhdGggPT09IGZpbGUucGF0aCB8fCBiYXNlbmFtZShub3JtYWxpemVkUGF0aCkgPT09IGZpbGUubmFtZTtcbiAgfVxuXG4gIHJlcGxhY2VDYW52YXNBc3NldExpbmtzKGNvbnRlbnQ6IHN0cmluZywgZmlsZTogVEZpbGUsIHVybDogc3RyaW5nKSB7XG4gICAgbGV0IGRhdGE7XG5cbiAgICB0cnkge1xuICAgICAgZGF0YSA9IEpTT04ucGFyc2UoY29udGVudCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjb250ZW50LFxuICAgICAgICByZXBsYWNlZDogMCxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGRhdGEubm9kZXMpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBjb250ZW50LFxuICAgICAgICByZXBsYWNlZDogMCxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgbGV0IHJlcGxhY2VkID0gMDtcblxuICAgIGRhdGEubm9kZXMuZm9yRWFjaCgobm9kZTogYW55KSA9PiB7XG4gICAgICBpZiAoXG4gICAgICAgIG5vZGUgJiZcbiAgICAgICAgbm9kZS50eXBlID09PSBcImZpbGVcIiAmJlxuICAgICAgICB0eXBlb2Ygbm9kZS5maWxlID09PSBcInN0cmluZ1wiICYmXG4gICAgICAgIHRoaXMuaXNTYW1lUm9vdEFzc2V0KG5vZGUuZmlsZSwgZmlsZSlcbiAgICAgICkge1xuICAgICAgICBub2RlLnR5cGUgPSBcImxpbmtcIjtcbiAgICAgICAgbm9kZS51cmwgPSB1cmw7XG4gICAgICAgIGRlbGV0ZSBub2RlLmZpbGU7XG4gICAgICAgIHJlcGxhY2VkKys7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29udGVudDogcmVwbGFjZWQgPiAwID8gSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgXCJcXHRcIikgOiBjb250ZW50LFxuICAgICAgcmVwbGFjZWQsXG4gICAgfTtcbiAgfVxuXG4gIHJlcGxhY2VBc3NldExpbmtzKGNvbnRlbnQ6IHN0cmluZywgZmlsZTogVEZpbGUsIHVybDogc3RyaW5nKSB7XG4gICAgY29uc3QgZXNjYXBlUmVnRXhwID0gKHZhbHVlOiBzdHJpbmcpID0+IHtcbiAgICAgIHJldHVybiB2YWx1ZS5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7XG4gICAgfTtcblxuICAgIGNvbnN0IHdpa2lsaW5rUmVnZXggPSAvIVxcW1xcWyhbXlxcXV0rKVxcXVxcXS9nO1xuICAgIGNvbnN0IG1hcmtkb3duSW1hZ2VSZWdleCA9IC8hXFxbKFteXFxdXSopXFxdXFwoKFteKV0rKVxcKS9nO1xuICAgIGxldCByZXBsYWNlZCA9IDA7XG4gICAgY29uc3QgcmVwbGFjZW1lbnRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgY29uc3QgbmV3Q29udGVudCA9IGNvbnRlbnRcbiAgICAgIC5yZXBsYWNlKHdpa2lsaW5rUmVnZXgsIChzb3VyY2UsIHRhcmdldCkgPT4ge1xuICAgICAgICBjb25zdCBwYXRoID0gdGFyZ2V0LnNwbGl0KFwifFwiKVswXTtcbiAgICAgICAgY29uc3QgYWx0ID0gdGFyZ2V0LnNwbGl0KFwifFwiKVsxXSB8fCBmaWxlLm5hbWU7XG5cbiAgICAgICAgaWYgKCF0aGlzLmlzU2FtZVJvb3RBc3NldChwYXRoLCBmaWxlKSkge1xuICAgICAgICAgIHJldHVybiBzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXBsYWNlZCsrO1xuICAgICAgICByZXBsYWNlbWVudHMucHVzaChnZXRFbWJlZE1hcmtkb3duKGZpbGUubmFtZSwgdXJsLCBhbHQpKTtcbiAgICAgICAgcmV0dXJuIGBcXHUwMDAwUk9PVF9BU1NFVF8ke3JlcGxhY2VtZW50cy5sZW5ndGggLSAxfVxcdTAwMDBgO1xuICAgICAgfSlcbiAgICAgIC5yZXBsYWNlKG1hcmtkb3duSW1hZ2VSZWdleCwgKHNvdXJjZSwgYWx0LCB0YXJnZXQpID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLmlzU2FtZVJvb3RBc3NldCh0YXJnZXQsIGZpbGUpKSB7XG4gICAgICAgICAgcmV0dXJuIHNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcGxhY2VkKys7XG4gICAgICAgIHJlcGxhY2VtZW50cy5wdXNoKGdldEVtYmVkTWFya2Rvd24oZmlsZS5uYW1lLCB1cmwsIGFsdCkpO1xuICAgICAgICByZXR1cm4gYFxcdTAwMDBST09UX0FTU0VUXyR7cmVwbGFjZW1lbnRzLmxlbmd0aCAtIDF9XFx1MDAwMGA7XG4gICAgICB9KVxuICAgICAgLnJlcGxhY2UobmV3IFJlZ0V4cChlc2NhcGVSZWdFeHAoZmlsZS5uYW1lKSwgXCJnXCIpLCAoc291cmNlLCBvZmZzZXQsIGZ1bGxDb250ZW50KSA9PiB7XG4gICAgICAgIGlmICghaXNBc3NldFR5cGVBbkFzc2V0KGZpbGUubmFtZSkpIHtcbiAgICAgICAgICByZXR1cm4gc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYmVmb3JlID0gb2Zmc2V0ID4gMCA/IGZ1bGxDb250ZW50W29mZnNldCAtIDFdIDogXCJcIjtcbiAgICAgICAgY29uc3QgYWZ0ZXIgPSBmdWxsQ29udGVudFtvZmZzZXQgKyBzb3VyY2UubGVuZ3RoXSB8fCBcIlwiO1xuXG4gICAgICAgIGlmICgvW1xccHtMfVxccHtOfV9cXFtcXChcXC9cXFxcLlxcLV0vdS50ZXN0KGJlZm9yZSkpIHtcbiAgICAgICAgICByZXR1cm4gc291cmNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICgvW1xccHtMfVxccHtOfV9cXF1cXClcXHxcXC9cXFxcLlxcLV0vdS50ZXN0KGFmdGVyKSkge1xuICAgICAgICAgIHJldHVybiBzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXBsYWNlZCsrO1xuICAgICAgICByZXR1cm4gZ2V0RW1iZWRNYXJrZG93bihmaWxlLm5hbWUsIHVybCk7XG4gICAgICB9KVxuICAgICAgLnJlcGxhY2UoL1xcdTAwMDBST09UX0FTU0VUXyhcXGQrKVxcdTAwMDAvZywgKHNvdXJjZSwgaW5kZXgpID0+IHtcbiAgICAgICAgcmV0dXJuIHJlcGxhY2VtZW50c1tOdW1iZXIoaW5kZXgpXSB8fCBzb3VyY2U7XG4gICAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBjb250ZW50OiBuZXdDb250ZW50LFxuICAgICAgcmVwbGFjZWQsXG4gICAgfTtcbiAgfVxuXG4gIC8vIHVwbG9kYSBhbGwgZmlsZVxuICB1cGxvYWRBbGxGaWxlKCkge1xuICAgIGxldCBjb250ZW50ID0gdGhpcy5oZWxwZXIuZ2V0VmFsdWUoKTtcblxuICAgIGNvbnN0IGJhc2VQYXRoID0gKFxuICAgICAgdGhpcy5hcHAudmF1bHQuYWRhcHRlciBhcyBGaWxlU3lzdGVtQWRhcHRlclxuICAgICkuZ2V0QmFzZVBhdGgoKTtcbiAgICBjb25zdCBhY3RpdmVGaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICBjb25zdCBmaWxlTWFwID0gYXJyYXlUb09iamVjdCh0aGlzLmFwcC52YXVsdC5nZXRGaWxlcygpLCBcIm5hbWVcIik7XG4gICAgY29uc3QgZmlsZVBhdGhNYXAgPSBhcnJheVRvT2JqZWN0KHRoaXMuYXBwLnZhdWx0LmdldEZpbGVzKCksIFwicGF0aFwiKTtcbiAgICBsZXQgaW1hZ2VMaXN0OiBJbWFnZVtdID0gW107XG4gICAgY29uc3QgZmlsZUFycmF5ID0gdGhpcy5maWx0ZXJGaWxlKHRoaXMuaGVscGVyLmdldEFsbEZpbGVzKCkpO1xuXG4gICAgZm9yIChjb25zdCBtYXRjaCBvZiBmaWxlQXJyYXkpIHtcbiAgICAgIGNvbnN0IGltYWdlTmFtZSA9IG1hdGNoLm5hbWU7XG4gICAgICBjb25zdCBlbmNvZGVkVXJpID0gbWF0Y2gucGF0aDtcblxuICAgICAgaWYgKGVuY29kZWRVcmkuc3RhcnRzV2l0aChcImh0dHBcIikpIHtcbiAgICAgICAgaW1hZ2VMaXN0LnB1c2goe1xuICAgICAgICAgIHBhdGg6IG1hdGNoLnBhdGgsXG4gICAgICAgICAgbmFtZTogaW1hZ2VOYW1lLFxuICAgICAgICAgIHNvdXJjZTogbWF0Y2guc291cmNlLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGZpbGVOYW1lID0gYmFzZW5hbWUoZGVjb2RlVVJJKGVuY29kZWRVcmkpKTtcbiAgICAgICAgbGV0IGZpbGU7XG4gICAgICAgIC8vIOe7neWvuei3r+W+hFxuICAgICAgICBpZiAoZmlsZVBhdGhNYXBbZGVjb2RlVVJJKGVuY29kZWRVcmkpXSkge1xuICAgICAgICAgIGZpbGUgPSBmaWxlUGF0aE1hcFtkZWNvZGVVUkkoZW5jb2RlZFVyaSldO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g55u45a+56Lev5b6EXG4gICAgICAgIGlmIChcbiAgICAgICAgICAoIWZpbGUgJiYgZGVjb2RlVVJJKGVuY29kZWRVcmkpLnN0YXJ0c1dpdGgoXCIuL1wiKSkgfHxcbiAgICAgICAgICBkZWNvZGVVUkkoZW5jb2RlZFVyaSkuc3RhcnRzV2l0aChcIi4uL1wiKVxuICAgICAgICApIHtcbiAgICAgICAgICBjb25zdCBmaWxlUGF0aCA9IHJlc29sdmUoXG4gICAgICAgICAgICBqb2luKGJhc2VQYXRoLCBkaXJuYW1lKGFjdGl2ZUZpbGUucGF0aCkpLFxuICAgICAgICAgICAgZGVjb2RlVVJJKGVuY29kZWRVcmkpXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIGlmIChleGlzdHNTeW5jKGZpbGVQYXRoKSkge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IG5vcm1hbGl6ZVBhdGgoXG4gICAgICAgICAgICAgIHJlbGF0aXZlKFxuICAgICAgICAgICAgICAgIG5vcm1hbGl6ZVBhdGgoYmFzZVBhdGgpLFxuICAgICAgICAgICAgICAgIG5vcm1hbGl6ZVBhdGgoXG4gICAgICAgICAgICAgICAgICByZXNvbHZlKFxuICAgICAgICAgICAgICAgICAgICBqb2luKGJhc2VQYXRoLCBkaXJuYW1lKGFjdGl2ZUZpbGUucGF0aCkpLFxuICAgICAgICAgICAgICAgICAgICBkZWNvZGVVUkkoZW5jb2RlZFVyaSlcbiAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGZpbGUgPSBmaWxlUGF0aE1hcFtwYXRoXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8g5bC95Y+v6IO955+t6Lev5b6EXG4gICAgICAgIGlmICghZmlsZSkge1xuICAgICAgICAgIGZpbGUgPSB0aGlzLmdldEZpbGUoZmlsZU5hbWUsIGZpbGVNYXApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZpbGUpIHtcbiAgICAgICAgICBjb25zdCBhYnN0cmFjdEltYWdlRmlsZSA9IGpvaW4oYmFzZVBhdGgsIGZpbGUucGF0aCk7XG5cbiAgICAgICAgICBpZiAoaXNBc3NldFR5cGVBbkFzc2V0KGFic3RyYWN0SW1hZ2VGaWxlKSkge1xuICAgICAgICAgICAgaW1hZ2VMaXN0LnB1c2goe1xuICAgICAgICAgICAgICBwYXRoOiBhYnN0cmFjdEltYWdlRmlsZSxcbiAgICAgICAgICAgICAgbmFtZTogaW1hZ2VOYW1lLFxuICAgICAgICAgICAgICBzb3VyY2U6IG1hdGNoLnNvdXJjZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChpbWFnZUxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICBuZXcgTm90aWNlKHQoXCJDYW4gbm90IGZpbmQgaW1hZ2UgZmlsZVwiKSk7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ldyBOb3RpY2UoYOWFseaJvuWIsCR7aW1hZ2VMaXN0Lmxlbmd0aH3kuKrlm77lg4/mlofku7bvvIzlvIDlp4vkuIrkvKBgKTtcbiAgICB9XG5cbiAgICB0aGlzLnVwbG9hZGVyLnVwbG9hZEZpbGVzKGltYWdlTGlzdC5tYXAoaXRlbSA9PiBpdGVtLnBhdGgpKS50aGVuKHJlcyA9PiB7XG4gICAgICBpZiAocmVzLnN1Y2Nlc3MpIHtcbiAgICAgICAgbGV0IHVwbG9hZFVybExpc3QgPSByZXMucmVzdWx0O1xuXG4gICAgICAgIGlmIChpbWFnZUxpc3QubGVuZ3RoICE9PSB1cGxvYWRVcmxMaXN0Lmxlbmd0aCkge1xuICAgICAgICAgIG5ldyBOb3RpY2UoXG4gICAgICAgICAgICB0KFwiV2FybmluZzogdXBsb2FkIGZpbGVzIGlzIGRpZmZlcmVudCBvZiByZWNpdmVyIGZpbGVzIGZyb20gYXBpXCIpXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGltYWdlTGlzdC5tYXAoaXRlbSA9PiB7XG4gICAgICAgICAgY29uc3QgdXBsb2FkSW1hZ2UgPSB1cGxvYWRVcmxMaXN0LnNoaWZ0KCk7XG5cbiAgICAgICAgICBsZXQgbmFtZSA9IHRoaXMuaGFuZGxlTmFtZShpdGVtLm5hbWUpO1xuICAgICAgICAgIGNvbnRlbnQgPSBjb250ZW50LnJlcGxhY2VBbGwoXG4gICAgICAgICAgICBpdGVtLnNvdXJjZSxcbiAgICAgICAgICAgIGdldEVtYmVkTWFya2Rvd24oaXRlbS5uYW1lLCB1cGxvYWRJbWFnZSwgbmFtZSlcbiAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgY3VycmVudEZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuICAgICAgICBpZiAoYWN0aXZlRmlsZS5wYXRoICE9PSBjdXJyZW50RmlsZS5wYXRoKSB7XG4gICAgICAgICAgbmV3IE5vdGljZSh0KFwiRmlsZSBoYXMgYmVlbiBjaGFuZ2VkZCwgdXBsb2FkIGZhaWx1cmVcIikpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmhlbHBlci5zZXRWYWx1ZShjb250ZW50KTtcblxuICAgICAgICBpZiAodGhpcy5zZXR0aW5ncy5kZWxldGVTb3VyY2UpIHtcbiAgICAgICAgICBpbWFnZUxpc3QubWFwKGltYWdlID0+IHtcbiAgICAgICAgICAgIGlmICghaW1hZ2UucGF0aC5zdGFydHNXaXRoKFwiaHR0cFwiKSkge1xuICAgICAgICAgICAgICB1bmxpbmsoaW1hZ2UucGF0aCwgKCkgPT4ge30pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXcgTm90aWNlKFwiVXBsb2FkIGVycm9yXCIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgc2V0dXBQYXN0ZUhhbmRsZXIoKSB7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFxuICAgICAgICBcImVkaXRvci1wYXN0ZVwiLFxuICAgICAgICAoZXZ0OiBDbGlwYm9hcmRFdmVudCwgZWRpdG9yOiBFZGl0b3IsIG1hcmtkb3duVmlldzogTWFya2Rvd25WaWV3KSA9PiB7XG4gICAgICAgICAgY29uc3QgYWxsb3dVcGxvYWQgPSB0aGlzLmhlbHBlci5nZXRGcm9udG1hdHRlclZhbHVlKFxuICAgICAgICAgICAgXCJpbWFnZS1hdXRvLXVwbG9hZFwiLFxuICAgICAgICAgICAgdGhpcy5zZXR0aW5ncy51cGxvYWRCeUNsaXBTd2l0Y2hcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgbGV0IGZpbGVzID0gZXZ0LmNsaXBib2FyZERhdGEuZmlsZXM7XG4gICAgICAgICAgaWYgKCFhbGxvd1VwbG9hZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIOWJqui0tOadv+WGheWuueaciW1k5qC85byP55qE5Zu+54mH5pe2XG4gICAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3Mud29ya09uTmV0V29yaykge1xuICAgICAgICAgICAgY29uc3QgY2xpcGJvYXJkVmFsdWUgPSBldnQuY2xpcGJvYXJkRGF0YS5nZXREYXRhKFwidGV4dC9wbGFpblwiKTtcbiAgICAgICAgICAgIGNvbnN0IGltYWdlTGlzdCA9IHRoaXMuaGVscGVyXG4gICAgICAgICAgICAgIC5nZXRJbWFnZUxpbmsoY2xpcGJvYXJkVmFsdWUpXG4gICAgICAgICAgICAgIC5maWx0ZXIoaW1hZ2UgPT4gaW1hZ2UucGF0aC5zdGFydHNXaXRoKFwiaHR0cFwiKSlcbiAgICAgICAgICAgICAgLmZpbHRlcihcbiAgICAgICAgICAgICAgICBpbWFnZSA9PlxuICAgICAgICAgICAgICAgICAgIXRoaXMuaGVscGVyLmhhc0JsYWNrRG9tYWluKFxuICAgICAgICAgICAgICAgICAgICBpbWFnZS5wYXRoLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldHRpbmdzLm5ld1dvcmtCbGFja0RvbWFpbnNcbiAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgaWYgKGltYWdlTGlzdC5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICAgICAgdGhpcy51cGxvYWRlclxuICAgICAgICAgICAgICAgIC51cGxvYWRGaWxlcyhpbWFnZUxpc3QubWFwKGl0ZW0gPT4gaXRlbS5wYXRoKSlcbiAgICAgICAgICAgICAgICAudGhlbihyZXMgPT4ge1xuICAgICAgICAgICAgICAgICAgbGV0IHZhbHVlID0gdGhpcy5oZWxwZXIuZ2V0VmFsdWUoKTtcbiAgICAgICAgICAgICAgICAgIGlmIChyZXMuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICBsZXQgdXBsb2FkVXJsTGlzdCA9IHJlcy5yZXN1bHQ7XG4gICAgICAgICAgICAgICAgICAgIGltYWdlTGlzdC5tYXAoaXRlbSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXBsb2FkSW1hZ2UgPSB1cGxvYWRVcmxMaXN0LnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgbGV0IG5hbWUgPSB0aGlzLmhhbmRsZU5hbWUoaXRlbS5uYW1lKTtcblxuICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUucmVwbGFjZUFsbChcbiAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0uc291cmNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZ2V0RW1iZWRNYXJrZG93bihpdGVtLm5hbWUsIHVwbG9hZEltYWdlLCBuYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmhlbHBlci5zZXRWYWx1ZSh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBuZXcgTm90aWNlKFwiVXBsb2FkIGVycm9yXCIpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIOWJqui0tOadv+S4reaYr+WbvueJh+aXtui/m+ihjOS4iuS8oFxuICAgICAgICAgIGlmICh0aGlzLmNhblVwbG9hZChldnQuY2xpcGJvYXJkRGF0YSkpIHtcbiAgICAgICAgICAgIHRoaXMudXBsb2FkRmlsZUFuZEVtYmVkSW1ndXJJbWFnZShcbiAgICAgICAgICAgICAgZWRpdG9yLFxuICAgICAgICAgICAgICBhc3luYyAoZWRpdG9yOiBFZGl0b3IsIHBhc3RlSWQ6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgIGxldCByZXM6IGFueTtcbiAgICAgICAgICAgICAgICByZXMgPSBhd2FpdCB0aGlzLnVwbG9hZGVyLnVwbG9hZEZpbGVCeUNsaXBib2FyZChcbiAgICAgICAgICAgICAgICAgIGV2dC5jbGlwYm9hcmREYXRhLmZpbGVzXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIGlmIChyZXMuY29kZSAhPT0gMCkge1xuICAgICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVGYWlsZWRVcGxvYWQoZWRpdG9yLCBwYXN0ZUlkLCByZXMubXNnKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsID0gcmVzLmRhdGE7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gdXJsO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBldnQuY2xpcGJvYXJkRGF0YVxuICAgICAgICAgICAgKS5jYXRjaCgpO1xuICAgICAgICAgICAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICApXG4gICAgKTtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXG4gICAgICAgIFwiZWRpdG9yLWRyb3BcIixcbiAgICAgICAgYXN5bmMgKGV2dDogRHJhZ0V2ZW50LCBlZGl0b3I6IEVkaXRvciwgbWFya2Rvd25WaWV3OiBNYXJrZG93blZpZXcpID0+IHtcbiAgICAgICAgICAvLyB3aGVuIGN0cmwga2V5IGlzIHByZXNzZWQsIGRvIG5vdCB1cGxvYWQgaW1hZ2UsIGJlY2F1c2UgaXQgaXMgdXNlZCB0byBzZXQgbG9jYWwgZmlsZVxuICAgICAgICAgIGlmIChldnQuY3RybEtleSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb25zdCBhbGxvd1VwbG9hZCA9IHRoaXMuaGVscGVyLmdldEZyb250bWF0dGVyVmFsdWUoXG4gICAgICAgICAgICBcImltYWdlLWF1dG8tdXBsb2FkXCIsXG4gICAgICAgICAgICB0aGlzLnNldHRpbmdzLnVwbG9hZEJ5Q2xpcFN3aXRjaFxuICAgICAgICAgICk7XG4gICAgICAgICAgbGV0IGZpbGVzID0gZXZ0LmRhdGFUcmFuc2Zlci5maWxlcztcblxuICAgICAgICAgIGlmICghYWxsb3dVcGxvYWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBmaWxlcy5sZW5ndGggIT09IDAgJiZcbiAgICAgICAgICAgIChmaWxlc1swXS50eXBlLnN0YXJ0c1dpdGgoXCJpbWFnZVwiKSB8fFxuICAgICAgICAgICAgICBmaWxlc1swXS50eXBlLnN0YXJ0c1dpdGgoXCJ2aWRlb1wiKSB8fFxuICAgICAgICAgICAgICBmaWxlc1swXS50eXBlLnN0YXJ0c1dpdGgoXCJhdWRpb1wiKSlcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIGxldCBzZW5kRmlsZXM6IEFycmF5PHN0cmluZz4gPSBbXTtcbiAgICAgICAgICAgIGxldCBmaWxlcyA9IGV2dC5kYXRhVHJhbnNmZXIuZmlsZXM7XG4gICAgICAgICAgICBBcnJheS5mcm9tKGZpbGVzKS5mb3JFYWNoKChpdGVtLCBpbmRleCkgPT4ge1xuICAgICAgICAgICAgICBpZiAoaXRlbS5wYXRoKSB7XG4gICAgICAgICAgICAgICAgc2VuZEZpbGVzLnB1c2goaXRlbS5wYXRoKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHdlYlV0aWxzIH0gPSByZXF1aXJlKFwiZWxlY3Ryb25cIik7XG4gICAgICAgICAgICAgICAgY29uc3QgcGF0aCA9IHdlYlV0aWxzLmdldFBhdGhGb3JGaWxlKGl0ZW0pO1xuICAgICAgICAgICAgICAgIHNlbmRGaWxlcy5wdXNoKHBhdGgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy51cGxvYWRlci51cGxvYWRGaWxlcyhzZW5kRmlsZXMpO1xuXG4gICAgICAgICAgICBpZiAoZGF0YS5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgIGRhdGEucmVzdWx0Lm1hcCgodmFsdWU6IHN0cmluZywgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIGxldCBwYXN0ZUlkID0gKE1hdGgucmFuZG9tKCkgKyAxKS50b1N0cmluZygzNikuc3Vic3RyKDIsIDUpO1xuICAgICAgICAgICAgICAgIHRoaXMuaW5zZXJ0VGVtcG9yYXJ5VGV4dChlZGl0b3IsIHBhc3RlSWQpO1xuICAgICAgICAgICAgICAgIHRoaXMuZW1iZWRNYXJrRG93bkltYWdlKFxuICAgICAgICAgICAgICAgICAgZWRpdG9yLFxuICAgICAgICAgICAgICAgICAgcGFzdGVJZCxcbiAgICAgICAgICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgZmlsZXNbaW5kZXhdLm5hbWVcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG5ldyBOb3RpY2UoXCJVcGxvYWQgZXJyb3JcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICApXG4gICAgKTtcbiAgfVxuXG4gIGNhblVwbG9hZChjbGlwYm9hcmREYXRhOiBEYXRhVHJhbnNmZXIpIHtcbiAgICB0aGlzLnNldHRpbmdzLmFwcGx5SW1hZ2U7XG4gICAgY29uc3QgZmlsZXMgPSBjbGlwYm9hcmREYXRhLmZpbGVzO1xuICAgIGNvbnN0IHRleHQgPSBjbGlwYm9hcmREYXRhLmdldERhdGEoXCJ0ZXh0XCIpO1xuXG4gICAgY29uc3QgaGFzSW1hZ2VGaWxlID1cbiAgICAgIGZpbGVzLmxlbmd0aCAhPT0gMCAmJlxuICAgICAgKGZpbGVzWzBdLnR5cGUuc3RhcnRzV2l0aChcImltYWdlXCIpIHx8XG4gICAgICAgIGZpbGVzWzBdLnR5cGUuc3RhcnRzV2l0aChcInZpZGVvXCIpIHx8XG4gICAgICAgIGZpbGVzWzBdLnR5cGUuc3RhcnRzV2l0aChcImF1ZGlvXCIpKTtcbiAgICBpZiAoaGFzSW1hZ2VGaWxlKSB7XG4gICAgICBpZiAoISF0ZXh0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldHRpbmdzLmFwcGx5SW1hZ2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHVwbG9hZEZpbGVBbmRFbWJlZEltZ3VySW1hZ2UoXG4gICAgZWRpdG9yOiBFZGl0b3IsXG4gICAgY2FsbGJhY2s6IEZ1bmN0aW9uLFxuICAgIGNsaXBib2FyZERhdGE6IERhdGFUcmFuc2ZlclxuICApIHtcbiAgICBsZXQgcGFzdGVJZCA9IChNYXRoLnJhbmRvbSgpICsgMSkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCA1KTtcbiAgICB0aGlzLmluc2VydFRlbXBvcmFyeVRleHQoZWRpdG9yLCBwYXN0ZUlkKTtcbiAgICBjb25zdCBuYW1lID0gY2xpcGJvYXJkRGF0YS5maWxlc1swXS5uYW1lO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHVybCA9IGF3YWl0IGNhbGxiYWNrKGVkaXRvciwgcGFzdGVJZCk7XG4gICAgICB0aGlzLmVtYmVkTWFya0Rvd25JbWFnZShlZGl0b3IsIHBhc3RlSWQsIHVybCwgbmFtZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5oYW5kbGVGYWlsZWRVcGxvYWQoZWRpdG9yLCBwYXN0ZUlkLCBlKTtcbiAgICB9XG4gIH1cblxuICBpbnNlcnRUZW1wb3JhcnlUZXh0KGVkaXRvcjogRWRpdG9yLCBwYXN0ZUlkOiBzdHJpbmcpIHtcbiAgICBsZXQgcHJvZ3Jlc3NUZXh0ID0gaW1hZ2VBdXRvVXBsb2FkUGx1Z2luLnByb2dyZXNzVGV4dEZvcihwYXN0ZUlkKTtcbiAgICBlZGl0b3IucmVwbGFjZVNlbGVjdGlvbihwcm9ncmVzc1RleHQgKyBcIlxcblwiKTtcbiAgfVxuXG4gIHByaXZhdGUgc3RhdGljIHByb2dyZXNzVGV4dEZvcihpZDogc3RyaW5nKSB7XG4gICAgcmV0dXJuIGAhW1VwbG9hZGluZyBmaWxlLi4uJHtpZH1dKClgO1xuICB9XG5cbiAgZW1iZWRNYXJrRG93bkltYWdlKFxuICAgIGVkaXRvcjogRWRpdG9yLFxuICAgIHBhc3RlSWQ6IHN0cmluZyxcbiAgICBpbWFnZVVybDogYW55LFxuICAgIG5hbWU6IHN0cmluZyA9IFwiXCJcbiAgKSB7XG4gICAgbGV0IHByb2dyZXNzVGV4dCA9IGltYWdlQXV0b1VwbG9hZFBsdWdpbi5wcm9ncmVzc1RleHRGb3IocGFzdGVJZCk7XG4gICAgY29uc3QgaW1hZ2VOYW1lID0gdGhpcy5oYW5kbGVOYW1lKG5hbWUpO1xuXG4gICAgbGV0IG1hcmtEb3duSW1hZ2UgPSBnZXRFbWJlZE1hcmtkb3duKG5hbWUsIGltYWdlVXJsLCBpbWFnZU5hbWUpO1xuXG4gICAgaW1hZ2VBdXRvVXBsb2FkUGx1Z2luLnJlcGxhY2VGaXJzdE9jY3VycmVuY2UoXG4gICAgICBlZGl0b3IsXG4gICAgICBwcm9ncmVzc1RleHQsXG4gICAgICBtYXJrRG93bkltYWdlXG4gICAgKTtcbiAgfVxuXG4gIGhhbmRsZUZhaWxlZFVwbG9hZChlZGl0b3I6IEVkaXRvciwgcGFzdGVJZDogc3RyaW5nLCByZWFzb246IGFueSkge1xuICAgIG5ldyBOb3RpY2UocmVhc29uKTtcbiAgICBjb25zb2xlLmVycm9yKFwiRmFpbGVkIHJlcXVlc3Q6IFwiLCByZWFzb24pO1xuICAgIGxldCBwcm9ncmVzc1RleHQgPSBpbWFnZUF1dG9VcGxvYWRQbHVnaW4ucHJvZ3Jlc3NUZXh0Rm9yKHBhc3RlSWQpO1xuICAgIGltYWdlQXV0b1VwbG9hZFBsdWdpbi5yZXBsYWNlRmlyc3RPY2N1cnJlbmNlKFxuICAgICAgZWRpdG9yLFxuICAgICAgcHJvZ3Jlc3NUZXh0LFxuICAgICAgXCLimqDvuI91cGxvYWQgZmFpbGVkLCBjaGVjayBkZXYgY29uc29sZVwiXG4gICAgKTtcbiAgfVxuXG4gIGhhbmRsZU5hbWUobmFtZTogc3RyaW5nKSB7XG4gICAgY29uc3QgaW1hZ2VTaXplU3VmZml4ID0gdGhpcy5zZXR0aW5ncy5pbWFnZVNpemVTdWZmaXggfHwgXCJcIjtcblxuICAgIGlmICh0aGlzLnNldHRpbmdzLmltYWdlRGVzYyA9PT0gXCJvcmlnaW5cIikge1xuICAgICAgcmV0dXJuIGAke25hbWV9JHtpbWFnZVNpemVTdWZmaXh9YDtcbiAgICB9IGVsc2UgaWYgKHRoaXMuc2V0dGluZ3MuaW1hZ2VEZXNjID09PSBcIm5vbmVcIikge1xuICAgICAgcmV0dXJuIFwiXCI7XG4gICAgfSBlbHNlIGlmICh0aGlzLnNldHRpbmdzLmltYWdlRGVzYyA9PT0gXCJyZW1vdmVEZWZhdWx0XCIpIHtcbiAgICAgIGlmIChuYW1lID09PSBcImltYWdlLnBuZ1wiKSB7XG4gICAgICAgIHJldHVybiBcIlwiO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGAke25hbWV9JHtpbWFnZVNpemVTdWZmaXh9YDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGAke25hbWV9JHtpbWFnZVNpemVTdWZmaXh9YDtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgcmVwbGFjZUZpcnN0T2NjdXJyZW5jZShcbiAgICBlZGl0b3I6IEVkaXRvcixcbiAgICB0YXJnZXQ6IHN0cmluZyxcbiAgICByZXBsYWNlbWVudDogc3RyaW5nXG4gICkge1xuICAgIGxldCBsaW5lcyA9IGVkaXRvci5nZXRWYWx1ZSgpLnNwbGl0KFwiXFxuXCIpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxldCBjaCA9IGxpbmVzW2ldLmluZGV4T2YodGFyZ2V0KTtcbiAgICAgIGlmIChjaCAhPSAtMSkge1xuICAgICAgICBsZXQgZnJvbSA9IHsgbGluZTogaSwgY2g6IGNoIH07XG4gICAgICAgIGxldCB0byA9IHsgbGluZTogaSwgY2g6IGNoICsgdGFyZ2V0Lmxlbmd0aCB9O1xuICAgICAgICBlZGl0b3IucmVwbGFjZVJhbmdlKHJlcGxhY2VtZW50LCBmcm9tLCB0byk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl0sIm5hbWVzIjpbImNvcmUiLCJnbG9iYWwiLCJyZXF1aXJlJCQxIiwicmVxdWlyZSQkMiIsImlzZXhlIiwicGF0aCIsInJlcXVpcmUkJDAiLCJ3aGljaCIsInBhdGhLZXlNb2R1bGUiLCJyZXNvbHZlQ29tbWFuZCIsInNoZWJhbmdSZWdleCIsInNoZWJhbmdDb21tYW5kIiwicmVhZFNoZWJhbmciLCJyZXF1aXJlJCQzIiwiaXNXaW4iLCJwYXJzZSIsImVub2VudCIsImNyb3NzU3Bhd25Nb2R1bGUiLCJzdHJpcEZpbmFsTmV3bGluZSIsIm1pbWljRm4iLCJtaW1pY0ZuTW9kdWxlIiwib25ldGltZSIsIm9uZXRpbWVNb2R1bGUiLCJzaWduYWxzIiwiX29zIiwiX3JlYWx0aW1lIiwic2lnbmFsc0J5TmFtZSIsIm1ha2VFcnJvciIsIm5vcm1hbGl6ZVN0ZGlvIiwic3RkaW9Nb2R1bGUiLCJwcm9jZXNzIiwic2lnbmFsRXhpdE1vZHVsZSIsInNwYXduZWRLaWxsIiwic3Bhd25lZENhbmNlbCIsInNldHVwVGltZW91dCIsInZhbGlkYXRlVGltZW91dCIsInNldEV4aXRIYW5kbGVyIiwiaXNTdHJlYW0iLCJidWZmZXJTdHJlYW0iLCJzdHJlYW0iLCJnZXRTdHJlYW0iLCJnZXRTdHJlYW1Nb2R1bGUiLCJtZXJnZVN0cmVhbSIsImhhbmRsZUlucHV0IiwibWFrZUFsbFN0cmVhbSIsImdldFNwYXduZWRSZXN1bHQiLCJ2YWxpZGF0ZUlucHV0U3luYyIsIm1lcmdlUHJvbWlzZSIsImdldFNwYXduZWRQcm9taXNlIiwiam9pbkNvbW1hbmQiLCJnZXRFc2NhcGVkQ29tbWFuZCIsInBhcnNlQ29tbWFuZCIsInJlcXVpcmUkJDQiLCJyZXF1aXJlJCQ1IiwicmVxdWlyZSQkNiIsInJlcXVpcmUkJDciLCJyZXF1aXJlJCQ4IiwicmVxdWlyZSQkOSIsInJlcXVpcmUkJDEwIiwicmVxdWlyZSQkMTEiLCJleGVjYU1vZHVsZSIsInVzZXJJbmZvIiwiZXhlY2EiLCJleHRuYW1lIiwiQnVmZmVyIiwic3RydG9rMy5mcm9tQnVmZmVyIiwic3RydG9rMy5mcm9tU3RyZWFtIiwic3RydG9rMy5FbmRPZlN0cmVhbUVycm9yIiwiVG9rZW4uU3RyaW5nVHlwZSIsIlRva2VuLlVJTlQ4IiwiVG9rZW4uSU5UMzJfQkUiLCJUb2tlbi5VSU5UNjRfTEUiLCJUb2tlbi5VSU5UMTZfQkUiLCJUb2tlbi5VSU5UMTZfTEUiLCJUb2tlbi5VSU5UMzJfQkUiLCJUb2tlbi5VSU5UMzJfTEUiLCJtb21lbnQiLCJub3JtYWxpemVQYXRoIiwicmVsYXRpdmUiLCJOb3RpY2UiLCJyZXF1ZXN0VXJsIiwiam9pbiIsInJlYWRGaWxlIiwiZXhlYyIsIk1hcmtkb3duVmlldyIsIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIiwiUGx1Z2luIiwiYWRkSWNvbiIsIlRGaWxlIiwiYmFzZW5hbWUiLCJ1bmxpbmsiLCJyZXNvbHZlIiwiZGlybmFtZSIsImV4aXN0c1N5bmMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBMEJBLFNBQVMsVUFBVSxDQUFDLElBQUksRUFBRTtBQUMxQixFQUFFLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxFQUFFO0FBQ2hDLElBQUksTUFBTSxJQUFJLFNBQVMsQ0FBQyxrQ0FBa0MsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDbkYsR0FBRztBQUNILENBQUM7QUFDRDtBQUNBO0FBQ0EsU0FBUyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO0FBQ3BELEVBQUUsSUFBSSxHQUFHLEdBQUcsRUFBRSxDQUFDO0FBQ2YsRUFBRSxJQUFJLGlCQUFpQixHQUFHLENBQUMsQ0FBQztBQUM1QixFQUFFLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3JCLEVBQUUsSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQ2YsRUFBRSxJQUFJLElBQUksQ0FBQztBQUNYLEVBQUUsS0FBSyxJ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RyxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDN0ksQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUNQLENBQUM7O0FDckNNLE1BQU0sVUFBVSxHQUFHO0FBQzFCLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsTUFBTTtBQUNQLENBQUMsS0FBSztBQUNOLENBQUMsTUFBTTtBQUNQLENBQUMsTUFBTTtBQUNQLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsTUFBTTtBQUNQLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsTUFBTTtBQUNQLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsSUFBSTtBQUNMLENBQUMsS0FBSztBQUNOLENBQUMsSUFBSTtBQUNMLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsTUFBTTtBQUNQLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsTUFBTTtBQUNQLENBQUMsTUFBTTtBQUNQLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsTUFBTTtBQUNQLENBQUMsS0FBSztBQUNOLENBQUMsT0FBTztBQUNSLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsTUFBTTtBQUNQLENBQUMsTUFBTTtBQUNQLENBQUMsT0FBTztBQUNSLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsSUFBSTtBQUNMLENBQUMsSUFBSTtBQUNMLENBQUMsUUFBUTtBQUNULENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsSUFBSTtBQUNMLENBQUMsS0FBSztBQUNOLENBQUMsR0FBRztBQUNKLENBQUMsSUFBSTtBQUNMLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsT0FBTztBQUNSLENBQUMsS0FBSztBQUNOLENBQUMsTUFBTTtBQUNQLENBQUMsTUFBTTtBQUNQLENBQUMsTUFBTTtBQUNQLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsTUFBTTtBQUNQLENBQUMsTUFBTTtBQUNQLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsSUFBSTtBQUNMLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsTUFBTTtBQUNQLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsT0FBTztBQUNSLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsT0FBTztBQUNSLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsSUFBSTtBQUNMLENBQUMsS0FBSztBQUNOLENBQUMsSUFBSTtBQUNMLENBQUMsSUFBSTtBQUNMLENBQUMsS0FBSztBQUNOLENBQUMsTUFBTTtBQUNQLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsTUFBTTtBQUNQLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsU0FBUztBQUNWLENBQUMsT0FBTztBQUNSLENBQUMsS0FBSztBQUNOLENBQUMsTUFBTTtBQUNQLENBQUMsS0FBSztBQUNOLENBQUMsTUFBTTtBQUNQLENBQUMsS0FBSztBQUNOLENBQUMsS0FBSztBQUNOLENBQUMsQ0FBQztBQUNGO0FBQ08sTUFBTSxTQUFTLEdBQUc7QUFDekIsQ0FBQyxZQUFZO0FBQ2IsQ0FBQyxXQUFXO0FBQ1osQ0FBQyxXQUFXO0FBQ1osQ0FBQyxZQUFZO0FBQ2IsQ0FBQyxZQUFZO0FBQ2IsQ0FBQyxhQUFhO0FBQ2QsQ0FBQyxtQkFBbUI7QUFDcEIsQ0FBQyxtQkFBbUI7QUFDcEIsQ0FBQyxZQUFZO0FBQ2IsQ0FBQyxXQUFXO0FB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LElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQ3BFLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxtQkFBbUI7QUFDN0IsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0E7QUFDQSxFQUFFO0FBQ0YsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDcEQsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdkQsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdkQsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdkQsSUFBSTtBQUNKLEdBQUcsT0FBTztBQUNWLElBQUksR0FBRyxFQUFFLEtBQUs7QUFDZCxJQUFJLElBQUksRUFBRSxpQkFBaUI7QUFDM0IsSUFBSSxDQUFDO0FBQ0wsR0FBRztBQUNIO0FBQ0E7QUFDQTtBQUNBLEVBQUUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQzFFLEdBQUcsT0FBTztBQUNWLElB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QztTQUNGO2FBQU07QUFDTCxZQUFBLE9BQU8sQ0FBRyxFQUFBLElBQUksQ0FBRyxFQUFBLGVBQWUsRUFBRSxDQUFDO1NBQ3BDO0tBQ0Y7QUFFRCxJQUFBLE9BQU8sc0JBQXNCLENBQzNCLE1BQWMsRUFDZCxNQUFjLEVBQ2QsV0FBbUIsRUFBQTtRQUVuQixJQUFJLEtBQUssR0FBRyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzFDLFFBQUEsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDckMsSUFBSSxFQUFFLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNsQyxZQUFBLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO2dCQUNaLElBQUksSUFBSSxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUM7QUFDL0IsZ0JBQUEsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUM3QyxNQUFNLENBQUMsWUFBWSxDQUFDLFdBQVcsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQzNDLE1BQU07YUFDUDtTQUNGO0tBQ0Y7QUFDRjs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCwxLDIsMyw0LDUsNiw3LDgsOSwxMCwxMSwxMiwxMywxNCwxNSwxNiwxNywxOCwxOSwyMCwyMSwyMiwyMywyNCwyNSwyNiwyNywyOCwyOSwzMCwzMSwzMiwzMywzNCwzNSwzNiwzNywzOCwzOSw0MCw0Miw0Myw0NCw0NSw0Niw0Nyw0OCw0OSw1MCw1MSw1Miw1Myw1NF19
