// list block program xml
const PROGRAMS = [
    { "id": "Program1", "label": "Program 1", "file": "xml/tasks/task-1.xml" },
    { "id": "Program2", "label": "Program 2 (Incomplete)",   "file": "xml/tasks/task-2.xml" },
    { "id": "Program2Comp", "label": "Program 2 (Complete)",    "file": "xml/tasks/task-2-complete.xml" },
    // { "id": "Test1", "label": "Test 1",    "file": "xml/tests/test1.xml" },
    // { "id": "Test2", "label": "Test 2",    "file": "xml/tests/test2.xml" },
];

function populateProgramsToDom() {
    const select = document.getElementById('programSelect');
    select.innerHTML = '<option value="Default">None — select a program…</option>';
    PROGRAMS.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.label;
        select.appendChild(opt);
    });
}

function getProgramIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('programId');
    return v ? v.trim() : null;
}

function findProgramById(id) {
    const target = String(id).toLowerCase();
    return PROGRAMS.find(p => p.id.toLowerCase() === target);
}

async function fetchProgramXmlById(id) {
    const entry = PROGRAMS.find(p => p.id === id);
    if (!entry) throw new Error('Program not found');
    const res = await fetch(entry.file, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.statusText);
    return await res.text();
}


function loadXmlToWorkspace(workspace, xmlString) {
    try {
        const textToDom = (Blockly.Xml.textToDom || Blockly.utils.xml.textToDom);
        const xml = textToDom(xmlString);
        Blockly.Xml.clearWorkspaceAndLoadFromXml(xml.documentElement || xml, workspace);
        requestAnimationFrame(() => {
            if (typeof workspace.scrollCenter === 'function') workspace.scrollCenter();
            if (typeof Blockly.svgResize === 'function') Blockly.svgResize(workspace);
        });
    } catch (e) {
        alert("Invalid XML format.");
        console.error(e);
    }
}

async function loadSelectedProgramIntoWorkspace(workspace) {
    const select = document.getElementById('programSelect');
    const id = select.value;
    if (!id) {
        alert('Pick a program first.');
        return;
    }
    try {
        const xml = await fetchProgramXmlById(id);
        loadXmlToWorkspace(workspace, xml);
    } catch (e) {
        console.error(e);
        alert('Could not load XML file.');
    }
}

async function autoLoadProgramFromQuery(workspace) {
    const programId = getProgramIdFromQuery();
    if (!programId) {
        return;
    }

    const match = findProgramById(programId);
    if (!match) {
        console.warn(`No program found for id "${programId}".`);
        return;
    }

    const select = document.getElementById('programSelect');
    select.value = match.id;

    // Trigger the change event to load the program
    const changeEvent = new Event('change', { bubbles: true });
    select.dispatchEvent(changeEvent);
}

// Global instructions overlay manager
let instructionsManager = null;

function initWorkspace() {
    // load program as html select items
    populateProgramsToDom();

    // Initialize instructions overlay
    instructionsManager = window.initInstructionsOverlay();

    // Set initial button state based on default selection (Default)
    const select = document.getElementById('programSelect');
    const initialSelection = select.value; // This will be "Default"
    if (instructionsManager) {
        instructionsManager.setProgramId(initialSelection);
    }

    // Override the text_print block to use console.log instead of alert
    javascript.javascriptGenerator.forBlock['text_print'] = function(block, generator) {
        const msg = generator.valueToCode(block, 'TEXT', javascript.Order.NONE) || "''";
        return 'console.log(' + msg + ');\n';
    };

    // Blockly Workspace Initialization
    const workspace = Blockly.inject('blocklyDiv', {
        toolbox: toolboxConfig,
        grid: {spacing: 20, length: 3, colour: "#ccc", snap: true},
        zoom: {
            controls: true,
            wheel: true,
            startScale: 1.0,
            maxScale: 3,
            minScale: 0.3,
            scaleSpeed: 1.2,
            pinch: true
        },
        trashcan: true
    });

    window.workspace = workspace;

    let nav = new NavigationController();
    nav.init();
    nav.addWorkspace(workspace);

    // Signal that the workspace is injected and keyboard nav is registered, so
    // listeners (e.g. the keyboard-trainer module) can speak the startup
    // instruction at the moment it becomes actionable.
    document.dispatchEvent(new CustomEvent('acblock:workspace-ready'));

    const keyOverlay = new KeyOverlay({ hideDelayMs: 5000 });
    keyOverlay.attach();

    document.getElementById("runButton").addEventListener("click", () => {
        // Clear output panel
        clearOutput();

        // Setup output capture only when running code
        const restoreConsole = setupOutputCapture();

        generateCode(Blockly.getMainWorkspace());
        try {
            eval(document.getElementById("codeOutput").textContent);
        } catch (error) {
            appendOutput("Error: " + error.message);
        } finally {
            // Restore original console.log after execution
            restoreConsole();
        }
    });

    document.getElementById("languageSelect").addEventListener("change", generateCode);

    // Auto-load program when selection changes
    document.getElementById("programSelect").addEventListener("change", async () => {
        const select = document.getElementById("programSelect");
        const selectedId = select.value;

        // Update instructions manager with current program
        if (instructionsManager) {
            instructionsManager.setProgramId(selectedId);
        }

        if (!selectedId || selectedId === "Default") {
            // Clear workspace if no program selected
            workspace.clear();
            return;
        }

        try {
            const xml = await fetchProgramXmlById(selectedId);
            loadXmlToWorkspace(workspace, xml);
        } catch (e) {
            console.error(e);
            alert('Could not load the selected program.');
        }
    });

    document.getElementById("showShortcuts")?.addEventListener("click", () => {
        nav?.showShortcuts();
    });

    // Info button to show instructions
    document.getElementById("showInstructions")?.addEventListener("click", () => {
        instructionsManager?.show();
    });

    // auto select & load program if query param is provided
    autoLoadProgramFromQuery(workspace);
    // renderKeyboardHints(null);
}

function generateCode() {
    const language = document.getElementById("languageSelect").value;
    let code;
    switch (language) {
        case "javascript":
            code = javascript.javascriptGenerator.workspaceToCode(Blockly.getMainWorkspace());
            break;
        case "python":
            code = python.pythonGenerator.workspaceToCode(Blockly.getMainWorkspace());
            break;
        case "php":
            code = php.phpGenerator.workspaceToCode(Blockly.getMainWorkspace());
            break;
        case "lua":
            code = lua.luaGenerator.workspaceToCode(Blockly.getMainWorkspace());
            break;
        case "dart":
            code = dart.dartGenerator.workspaceToCode(Blockly.getMainWorkspace());
            break;
        case "xml":
            const xmlDom = Blockly.Xml.workspaceToDom(Blockly.getMainWorkspace());
            code = Blockly.Xml.domToPrettyText(xmlDom);
            break;
        default:
            code = "// Select a language";
    }
    let codePanel = document.getElementById("codeOutput");
    codePanel.textContent = code;
    codePanel.classList.remove('prettyprinted');
    if (typeof PR === 'object') {
        PR.prettyPrint();
    }
}

// Output panel management
let outputLineCount = 0;

function clearOutput() {
    const outputPanel = document.getElementById("outputPanel");
    outputPanel.innerHTML = '';
    outputLineCount = 0;
}

function appendOutput(text) {
    const outputPanel = document.getElementById("outputPanel");
    outputPanel.setAttribute('tabindex', '-1');

    // Split by newlines if the text contains multiple lines
    const lines = text.toString().split('\n');

    lines.forEach(line => {
        outputLineCount++;

        const lineDiv = document.createElement('div');
        lineDiv.className = 'output-line';
        lineDiv.setAttribute('data-output-line', outputLineCount);

        const lineNumber = document.createElement('div');
        lineNumber.className = 'output-line-number';
        lineNumber.textContent = outputLineCount;

        const lineContent = document.createElement('div');
        lineContent.className = 'output-line-content';
        lineContent.textContent = line;

        lineDiv.appendChild(lineNumber);
        lineDiv.appendChild(lineContent);
        outputPanel.appendChild(lineDiv);
    });

    // Auto-scroll to bottom
    outputPanel.scrollTop = outputPanel.scrollHeight;
}

function setupOutputCapture() {
    // Save original console.log
    const originalLog = console.log;

    // Override console.log
    console.log = function(...args) {
        // Call original console.log
        originalLog.apply(console, args);

        // Append to output panel
        const output = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        appendOutput(output);
    };

    // Return a function to restore the original console.log
    return function restoreConsole() {
        console.log = originalLog;
    };
}
