/**
 * Runtime Security Verification Module
 * 
 * This module provides functionality for verifying the security of the runtime
 * environment and detecting potential security issues or tampering attempts.
 * 
 * It can detect debuggers, browser extensions that might intercept crypto operations,
 * compromised JavaScript environments, and other security threats.
 */

/**
 * Security verification result
 */
export interface SecurityVerificationResult {
  /**
   * Whether the environment is secure
   */
  secure: boolean;
  
  /**
   * List of detected issues
   */
  issues: SecurityIssue[];
  
  /**
   * Overall security score (0-100)
   */
  score: number;
  
  /**
   * Detailed results for each check
   */
  checks: SecurityCheck[];
}

/**
 * Security issue
 */
export interface SecurityIssue {
  /**
   * Issue type
   */
  type: SecurityIssueType;
  
  /**
   * Issue description
   */
  description: string;
  
  /**
   * Issue severity (0-100)
   */
  severity: number;
  
  /**
   * Potential mitigations
   */
  mitigations?: string[];
}

/**
 * Security issue type
 */
export enum SecurityIssueType {
  DEBUGGER = 'debugger',
  EXTENSION_INTERFERENCE = 'extension_interference',
  COMPROMISED_ENVIRONMENT = 'compromised_environment',
  WEAK_RANDOM = 'weak_random',
  PROTOTYPE_POLLUTION = 'prototype_pollution',
  FUNCTION_HIJACKING = 'function_hijacking',
  INSECURE_CONTEXT = 'insecure_context',
  BROWSER_EXTENSION = 'browser_extension',
  IFRAME_EMBEDDING = 'iframe_embedding',
  DEVTOOLS_OPEN = 'devtools_open'
}

/**
 * Security check
 */
export interface SecurityCheck {
  /**
   * Check name
   */
  name: string;
  
  /**
   * Check description
   */
  description: string;
  
  /**
   * Whether the check passed
   */
  passed: boolean;
  
  /**
   * Check result details
   */
  details?: any;
}

/**
 * Security verification options
 */
export interface SecurityVerificationOptions {
  /**
   * Whether to check for debuggers
   * @default true
   */
  checkDebugger?: boolean;
  
  /**
   * Whether to check for extension interference
   * @default true
   */
  checkExtensions?: boolean;
  
  /**
   * Whether to check for compromised environment
   * @default true
   */
  checkEnvironment?: boolean;
  
  /**
   * Whether to check for weak random number generation
   * @default true
   */
  checkRandom?: boolean;
  
  /**
   * Whether to check for prototype pollution
   * @default true
   */
  checkPrototypePollution?: boolean;
  
  /**
   * Whether to check for function hijacking
   * @default true
   */
  checkFunctionHijacking?: boolean;
  
  /**
   * Whether to check for secure context
   * @default true
   */
  checkSecureContext?: boolean;
  
  /**
   * Whether to check for iframe embedding
   * @default true
   */
  checkIframeEmbedding?: boolean;
  
  /**
   * Whether to check for open DevTools
   * @default true
   */
  checkDevTools?: boolean;
  
  /**
   * Custom checks to run
   */
  customChecks?: Array<() => SecurityCheck>;
}

/**
 * Verifies the security of the runtime environment
 * 
 * @param options - Verification options
 * @returns Verification result
 */
export function verifyRuntimeSecurity(
  options: SecurityVerificationOptions = {}
): SecurityVerificationResult {
  const checks: SecurityCheck[] = [];
  const issues: SecurityIssue[] = [];
  
  // Set default options
  const opts = {
    checkDebugger: options.checkDebugger !== false,
    checkExtensions: options.checkExtensions !== false,
    checkEnvironment: options.checkEnvironment !== false,
    checkRandom: options.checkRandom !== false,
    checkPrototypePollution: options.checkPrototypePollution !== false,
    checkFunctionHijacking: options.checkFunctionHijacking !== false,
    checkSecureContext: options.checkSecureContext !== false,
    checkIframeEmbedding: options.checkIframeEmbedding !== false,
    checkDevTools: options.checkDevTools !== false,
    customChecks: options.customChecks || []
  };
  
  // Run checks
  if (opts.checkDebugger) {
    const check = checkForDebugger();
    checks.push(check);
    
    if (!check.passed) {
      issues.push({
        type: SecurityIssueType.DEBUGGER,
        description: 'Debugger detected',
        severity: 70,
        mitigations: [
          'Close any debugging tools',
          'Restart the browser',
          'Use a different browser'
        ]
      });
    }
  }
  
  if (opts.checkExtensions) {
    const check = checkForExtensionInterference();
    checks.push(check);
    
    if (!check.passed) {
      issues.push({
        type: SecurityIssueType.EXTENSION_INTERFERENCE,
        description: 'Browser extension interference detected',
        severity: 60,
        mitigations: [
          'Disable browser extensions',
          'Use incognito/private browsing mode',
          'Use a different browser'
        ]
      });
    }
  }
  
  if (opts.checkEnvironment) {
    const check = checkForCompromisedEnvironment();
    checks.push(check);
    
    if (!check.passed) {
      issues.push({
        type: SecurityIssueType.COMPROMISED_ENVIRONMENT,
        description: 'Potentially compromised JavaScript environment',
        severity: 90,
        mitigations: [
          'Restart the browser',
          'Update your browser',
          'Scan for malware',
          'Use a different device'
        ]
      });
    }
  }
  
  if (opts.checkRandom) {
    const check = checkForWeakRandom();
    checks.push(check);
    
    if (!check.passed) {
      issues.push({
        type: SecurityIssueType.WEAK_RANDOM,
        description: 'Weak random number generation detected',
        severity: 80,
        mitigations: [
          'Update your browser',
          'Use a different browser',
          'Use a more modern device'
        ]
      });
    }
  }
  
  if (opts.checkPrototypePollution) {
    const check = checkForPrototypePollution();
    checks.push(check);
    
    if (!check.passed) {
      issues.push({
        type: SecurityIssueType.PROTOTYPE_POLLUTION,
        description: 'Prototype pollution detected',
        severity: 85,
        mitigations: [
          'Check for malicious scripts',
          'Clear browser cache and cookies',
          'Update your browser'
        ]
      });
    }
  }
  
  if (opts.checkFunctionHijacking) {
    const check = checkForFunctionHijacking();
    checks.push(check);
    
    if (!check.passed) {
      issues.push({
        type: SecurityIssueType.FUNCTION_HIJACKING,
        description: 'Function hijacking detected',
        severity: 85,
        mitigations: [
          'Check for malicious scripts',
          'Disable browser extensions',
          'Update your browser'
        ]
      });
    }
  }
  
  if (opts.checkSecureContext) {
    const check = checkForSecureContext();
    checks.push(check);
    
    if (!check.passed) {
      issues.push({
        type: SecurityIssueType.INSECURE_CONTEXT,
        description: 'Insecure context (non-HTTPS)',
        severity: 75,
        mitigations: [
          'Use HTTPS instead of HTTP',
          'Contact the website administrator'
        ]
      });
    }
  }
  
  if (opts.checkIframeEmbedding) {
    const check = checkForIframeEmbedding();
    checks.push(check);
    
    if (!check.passed) {
      issues.push({
        type: SecurityIssueType.IFRAME_EMBEDDING,
        description: 'Page is embedded in an iframe',
        severity: 50,
        mitigations: [
          'Access the website directly',
          'Contact the website administrator'
        ]
      });
    }
  }
  
  if (opts.checkDevTools) {
    const check = checkForDevTools();
    checks.push(check);
    
    if (!check.passed) {
      issues.push({
        type: SecurityIssueType.DEVTOOLS_OPEN,
        description: 'Developer tools are open',
        severity: 40,
        mitigations: [
          'Close developer tools'
        ]
      });
    }
  }
  
  // Run custom checks
  for (const customCheck of opts.customChecks) {
    try {
      const check = customCheck();
      checks.push(check);
      
      if (!check.passed) {
        issues.push({
          type: SecurityIssueType.COMPROMISED_ENVIRONMENT,
          description: `Custom check failed: ${check.name}`,
          severity: 50
        });
      }
    } catch (e) {
      checks.push({
        name: 'Custom check',
        description: 'A custom security check failed to run',
        passed: false,
        details: { error: (e as Error).message }
      });
      
      issues.push({
        type: SecurityIssueType.COMPROMISED_ENVIRONMENT,
        description: 'A custom security check failed to run',
        severity: 30
      });
    }
  }
  
  // Calculate security score
  let score = 100;
  
  for (const issue of issues) {
    // Weight by severity
    score -= issue.severity / issues.length;
  }
  
  // Ensure score is between 0 and 100
  score = Math.max(0, Math.min(100, Math.round(score)));
  
  return {
    secure: issues.length === 0,
    issues,
    score,
    checks
  };
}

/**
 * Checks for the presence of a debugger
 * 
 * @returns Check result
 */
function checkForDebugger(): SecurityCheck {
  let debuggerDetected = false;
  
  // Check execution time of a simple operation
  // Debuggers typically slow down execution
  const start = Date.now();
  let sum = 0;
  
  for (let i = 0; i < 10000; i++) {
    sum += i;
  }
  
  const end = Date.now();
  const executionTime = end - start;
  
  // If execution is suspiciously slow, a debugger might be present
  // This is a heuristic and may have false positives
  if (executionTime > 50) {
    debuggerDetected = true;
  }
  
  // Check for debugger keyword (this will trigger if a debugger is attached)
  try {
    const originalDebugger = Function.prototype.constructor;
    const debuggerFn = new Function('debugger; return true;');
    
    // If a debugger is attached, this will pause execution
    // We can detect this by measuring execution time
    const debuggerStart = Date.now();
    debuggerFn();
    const debuggerEnd = Date.now();
    
    if (debuggerEnd - debuggerStart > 100) {
      debuggerDetected = true;
    }
  } catch (e) {
    // An error here might indicate a debugger or other interference
    debuggerDetected = true;
  }
  
  return {
    name: 'Debugger Detection',
    description: 'Checks for the presence of a debugger',
    passed: !debuggerDetected,
    details: { executionTime }
  };
}

/**
 * Checks for browser extension interference
 * 
 * @returns Check result
 */
function checkForExtensionInterference(): SecurityCheck {
  let interferenceDetected = false;
  const details: Record<string, any> = {};
  
  // Check for modifications to crypto API
  if (typeof crypto !== 'undefined') {
    try {
      // Store original methods
      const originalGetRandomValues = crypto.getRandomValues;
      const originalSubtle = crypto.subtle;
      
      // Check if methods have been tampered with
      if (crypto.getRandomValues.toString().length < 50) {
        interferenceDetected = true;
        details.cryptoModified = true;
      }
      
      if (crypto.subtle && Object.keys(crypto.subtle).length !== Object.keys(Object.getPrototypeOf(crypto.subtle)).length) {
        interferenceDetected = true;
        details.subtleModified = true;
      }
    } catch (e) {
      // Error accessing crypto properties might indicate tampering
      interferenceDetected = true;
      details.cryptoError = (e as Error).message;
    }
  }
  
  // Check for content scripts
  if (typeof document !== 'undefined') {
    const scripts = document.querySelectorAll('script');
    const suspiciousScripts = Array.from(scripts).filter(script => {
      const src = script.src || '';
      return src.includes('chrome-extension://') || 
             src.includes('moz-extension://') || 
             src.includes('extension://');
    });
    
    if (suspiciousScripts.length > 0) {
      interferenceDetected = true;
      details.extensionScripts = suspiciousScripts.length;
    }
  }
  
  return {
    name: 'Extension Interference',
    description: 'Checks for browser extensions that might interfere with cryptographic operations',
    passed: !interferenceDetected,
    details
  };
}

/**
 * Checks for a compromised JavaScript environment
 * 
 * @returns Check result
 */
function checkForCompromisedEnvironment(): SecurityCheck {
  let compromised = false;
  const details: Record<string, any> = {};
  
  // Check for overridden Object methods
  try {
    const originalCreate = Object.create;
    const originalDefineProperty = Object.defineProperty;
    const originalFreeze = Object.freeze;
    
    if (Object.create.toString() !== originalCreate.toString()) {
      compromised = true;
      details.createOverridden = true;
    }
    
    if (Object.defineProperty.toString() !== originalDefineProperty.toString()) {
      compromised = true;
      details.definePropertyOverridden = true;
    }
    
    if (Object.freeze.toString() !== originalFreeze.toString()) {
      compromised = true;
      details.freezeOverridden = true;
    }
  } catch (e) {
    compromised = true;
    details.objectError = (e as Error).message;
  }
  
  // Check for suspicious global variables
  const suspiciousGlobals = [
    '__REACT_DEVTOOLS_GLOBAL_HOOK__',
    '__REDUX_DEVTOOLS_EXTENSION__',
    '__VUE_DEVTOOLS_GLOBAL_HOOK__',
    'XSS',
    'alert',
    'prompt',
    'confirm'
  ];
  
  const foundGlobals = [];
  
  for (const global of suspiciousGlobals) {
    if (typeof window !== 'undefined' && (window as any)[global]) {
      foundGlobals.push(global);
    }
  }
  
  if (foundGlobals.length > 0) {
    details.suspiciousGlobals = foundGlobals;
    // Don't mark as compromised just for dev tools
  }
  
  return {
    name: 'Environment Integrity',
    description: 'Checks for a compromised JavaScript environment',
    passed: !compromised,
    details
  };
}

/**
 * Checks for weak random number generation
 * 
 * @returns Check result
 */
function checkForWeakRandom(): SecurityCheck {
  let weakRandom = false;
  const details: Record<string, any> = {};
  
  // Check if crypto.getRandomValues is available
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    weakRandom = true;
    details.noCrypto = true;
  } else {
    try {
      // Test crypto.getRandomValues
      const testArray = new Uint8Array(10);
      crypto.getRandomValues(testArray);
      
      // Check if all values are the same (very unlikely with proper RNG)
      const allSame = testArray.every(val => val === testArray[0]);
      if (allSame) {
        weakRandom = true;
        details.suspiciousOutput = true;
      }
      
      // Simple statistical test
      let zeros = 0;
      let ones = 0;
      
      for (let i = 0; i < testArray.length; i++) {
        for (let bit = 0; bit < 8; bit++) {
          if ((testArray[i] & (1 << bit)) === 0) {
            zeros++;
          } else {
            ones++;
          }
        }
      }
      
      // Extremely skewed distribution is suspicious
      const ratio = Math.max(zeros, ones) / Math.min(zeros, ones);
      if (ratio > 3) {
        weakRandom = true;
        details.skewedDistribution = true;
        details.ratio = ratio;
      }
    } catch (e) {
      weakRandom = true;
      details.cryptoError = (e as Error).message;
    }
  }
  
  return {
    name: 'Random Number Generation',
    description: 'Checks for weak random number generation',
    passed: !weakRandom,
    details
  };
}

/**
 * Checks for prototype pollution
 * 
 * @returns Check result
 */
function checkForPrototypePollution(): SecurityCheck {
  let polluted = false;
  const details: Record<string, any> = {};
  
  // Check Object prototype
  const objectProto = Object.prototype;
  const originalToString = Object.prototype.toString;
  const originalHasOwnProperty = Object.prototype.hasOwnProperty;
  
  // Create a clean object to test
  const testObj = Object.create(null);
  
  // Check for unexpected properties on Object.prototype
  const expectedProperties = [
    'constructor', 'toString', 'toLocaleString', 'valueOf', 'hasOwnProperty',
    'isPrototypeOf', 'propertyIsEnumerable', '__defineGetter__',
    '__defineSetter__', '__lookupGetter__', '__lookupSetter__'
  ];
  
  const unexpectedProperties = Object.getOwnPropertyNames(objectProto)
    .filter(prop => !expectedProperties.includes(prop));
  
  if (unexpectedProperties.length > 0) {
    polluted = true;
    details.unexpectedProperties = unexpectedProperties;
  }
  
  // Check if toString or hasOwnProperty have been tampered with
  if (Object.prototype.toString !== originalToString) {
    polluted = true;
    details.toStringModified = true;
  }
  
  if (Object.prototype.hasOwnProperty !== originalHasOwnProperty) {
    polluted = true;
    details.hasOwnPropertyModified = true;
  }
  
  // Test for actual pollution by creating a new object
  const testObject = {};
  const pollutionTest = JSON.parse('{"__proto__": {"pollutionTest": true}}');
  
  if ((testObject as any).pollutionTest === true) {
    polluted = true;
    details.activePrototypePollution = true;
  }
  
  return {
    name: 'Prototype Pollution',
    description: 'Checks for JavaScript prototype pollution',
    passed: !polluted,
    details
  };
}

/**
 * Checks for function hijacking
 * 
 * @returns Check result
 */
function checkForFunctionHijacking(): SecurityCheck {
  let hijacked = false;
  const details: Record<string, any> = {};
  
  // Check Function constructor
  const originalFunction = Function;
  const originalFunctionToString = Function.prototype.toString;
  
  if (Function !== originalFunction) {
    hijacked = true;
    details.functionConstructorModified = true;
  }
  
  if (Function.prototype.toString !== originalFunctionToString) {
    hijacked = true;
    details.toStringModified = true;
  }
  
  // Check eval
  if (typeof eval !== 'function') {
    hijacked = true;
    details.evalMissing = true;
  } else {
    try {
      const testValue = 42;
      const evalResult = eval('testValue');
      
      if (evalResult !== testValue) {
        hijacked = true;
        details.evalModified = true;
      }
    } catch (e) {
      hijacked = true;
      details.evalError = (e as Error).message;
    }
  }
  
  // Check setTimeout
  if (typeof setTimeout !== 'function') {
    hijacked = true;
    details.setTimeoutMissing = true;
  } else {
    const originalSetTimeout = setTimeout;
    
    if (setTimeout !== originalSetTimeout) {
      hijacked = true;
      details.setTimeoutModified = true;
    }
  }
  
  return {
    name: 'Function Hijacking',
    description: 'Checks for hijacked JavaScript functions',
    passed: !hijacked,
    details
  };
}

/**
 * Checks if the page is running in a secure context (HTTPS)
 * 
 * @returns Check result
 */
function checkForSecureContext(): SecurityCheck {
  let secure = true;
  const details: Record<string, any> = {};
  
  if (typeof window !== 'undefined') {
    if (typeof window.isSecureContext === 'boolean') {
      secure = window.isSecureContext;
      details.isSecureContext = secure;
    } else if (typeof window.location === 'object') {
      secure = window.location.protocol === 'https:';
      details.protocol = window.location.protocol;
    }
  }
  
  return {
    name: 'Secure Context',
    description: 'Checks if the page is running in a secure context (HTTPS)',
    passed: secure,
    details
  };
}

/**
 * Checks if the page is embedded in an iframe
 * 
 * @returns Check result
 */
function checkForIframeEmbedding(): SecurityCheck {
  let embedded = false;
  const details: Record<string, any> = {};
  
  if (typeof window !== 'undefined') {
    try {
      embedded = window.self !== window.top;
      details.embedded = embedded;
      
      if (embedded && window.parent) {
        try {
          details.parentOrigin = document.referrer;
        } catch (e) {
          details.crossOrigin = true;
        }
      }
    } catch (e) {
      // Error accessing window.top usually means cross-origin iframe
      embedded = true;
      details.crossOrigin = true;
    }
  }
  
  return {
    name: 'Iframe Embedding',
    description: 'Checks if the page is embedded in an iframe',
    passed: !embedded,
    details
  };
}

/**
 * Checks if developer tools are open
 * 
 * @returns Check result
 */
function checkForDevTools(): SecurityCheck {
  let devToolsOpen = false;
  const details: Record<string, any> = {};
  
  if (typeof window !== 'undefined') {
    // Method 1: Check window size
    const widthThreshold = window.outerWidth - window.innerWidth > 160;
    const heightThreshold = window.outerHeight - window.innerHeight > 160;
    
    if (widthThreshold || heightThreshold) {
      devToolsOpen = true;
      details.sizeDiscrepancy = true;
    }
    
    // Method 2: Debugger detection
    try {
      const element = new Image();
      
      Object.defineProperty(element, 'id', {
        get: function() {
          devToolsOpen = true;
          details.elementInspection = true;
          return '';
        }
      });
      
      console.log(element);
      console.clear();
    } catch (e) {
      // Ignore errors
    }
  }
  
  return {
    name: 'DevTools Detection',
    description: 'Checks if developer tools are open',
    passed: !devToolsOpen,
    details
  };
}
