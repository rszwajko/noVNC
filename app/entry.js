
import UI from "./ui.js";
import * as Log from '../core/util/logging.js';

        // check for data injected via <script> tag
const injectedData = JSON.parse(document.getElementById("injectedData")?.text ?? "null");

        // Default settings will be loaded from defaults.json. Mandatory
        // settings will be loaded from mandatory.json, which the user
        // cannot change.
const fetchConfig = async (filePath) => {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw Error("" + response.status + " " + response.statusText);
        }

        return await response.json();
    } catch (err) {
        Log.Error(`Couldn't fetch ${filePath}: ` + err);
        return null;
    }
};

const defaults = injectedData?.defaults ?? await fetchConfig('./defaults.json');
const mandatory = injectedData?.mandatory ?? await fetchConfig('./mandatory.json');

        // You can also override any defaults you need here:
        //
        // defaults['host'] = 'vnc.example.com';

        // Or force a specific setting, preventing the user from
        // changing it:
        //
        // mandatory['view_only'] = true;

        // See docs/EMBEDDING.md for a list of possible settings.

UI.start({ settings: { defaults: defaults ?? {},
                       mandatory: mandatory ?? {}} });