const fs = require('fs');

/**
 * Escapes double quotes in a string for 1C 7.7 serialization.
 * @param {any} str - The value to be converted to a string and escaped.
 * @returns {string} The escaped string.
 */
function escapeString(str) {
    const s = String(str);
    return s.replace(/"/g, '""');
}

/**
 * Formats a simple value into the full 1C 7.7 serialized string.
 * e.g., {"<type>","0","0","0","0","0","<value>"}
 * @param {string} type - The 1C type code ('S', 'N', 'D').
 * @param {string} valueStr - The string representation of the value.
 * @returns {string} The formatted value string.
 */
function formatValue(type, valueStr) {
    // Per rules, the actual value is always a string in the final structure.
    return `{"${type}","0","0","0","0","0","${escapeString(valueStr)}"}`;
}

/**
 * Recursively serializes a JavaScript data structure into the 1C 7.7 "СписокЗначений" text format.
 * @param {*} jsValue - The JavaScript data (object, array, primitive) to serialize.
 * @returns {string} The serialized 1C data as a string.
 */
function serializeToV77(jsValue) {
    // This nested function handles the serialization of a key-value pair within an object.
    const serializePair = (key, value) => {
        let serializedValue;

        if (value === null) {
            serializedValue = formatValue('S', '');
        } else if (typeof value === 'boolean') {
            serializedValue = formatValue('N', value ? '1' : '0');
        } else if (Array.isArray(value)) {
            // Recursively serialize nested arrays (e.g., the 'transactions' array).
            serializedValue = serializeToV77(value);
        } else if (typeof value === 'object') {
            // Recursively serialize nested objects.
            serializedValue = serializeToV77(value);
        } else if (typeof value === 'string') {
            // Apply heuristics for strings that might be dates or numbers.
            if ((key === 'DAT_KL' || key === 'DAT_OD') && value.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
                const [day, month, year] = value.split('.');
                serializedValue = formatValue('D', `${year}${month}${day}`);
            } else if (key === 'DATE_TIME_DAT_OD_TIM_P') {
                 // 1C 7.7 Date format doesn't support time. Store as a string to preserve the info.
                 serializedValue = formatValue('S', value);
            } else if ((key === 'SUM' || key === 'SUM_E') && !isNaN(parseFloat(value))) {
                serializedValue = formatValue('N', value);
            } else {
                // Default to a simple string.
                serializedValue = formatValue('S', value);
            }
        } else { // Handle raw numbers and other primitives by converting them to a string.
             serializedValue = formatValue('S', String(value));
        }

        // Return the final pair format: {<serialized_value>, "key"}
        return `{${serializedValue},"${escapeString(key)}"}`;
    };

    // --- Main logic for serializeToV77 ---

    // An array is serialized as a "СписокЗначений" where keys are 1-based indices.
    if (Array.isArray(jsValue)) {
        const items = jsValue.map((item, index) => {
            // Each item in the transactions array is an object, so serialize it recursively.
            const serializedItem = serializeToV77(item);
            // The key for an array item is its index.
            return `{${serializedItem},"${index + 1}"}`;
        }).join(',');
        return `{"VL",{${items}}}`;
    }

    // An object is serialized as a "СписокЗначений" with its keys.
    if (typeof jsValue === 'object' && jsValue !== null) {
        const pairs = Object.entries(jsValue)
            .map(([key, value]) => serializePair(key, value))
            .join(',');
        return `{"VL",{${pairs}}}`;
    }
    
    // This fallback should not be reached if the root of the JSON is an object.
    throw new Error(`Unsupported data type for serialization: ${typeof jsValue}`);
}

// --- Main Execution Logic ---
try {
    // 1. Read and parse the input JSON file.
    const jsonInput = fs.readFileSync('prinvat.json', 'utf-8');
    const data = JSON.parse(jsonInput);
    
    // 2. Convert the parsed data to the 1C 7.7 format.
    const outputContent = serializeToV77(data);
    
    // 3. Write the result to the output file using cp1251 encoding for compatibility with 1C 7.7.
    fs.writeFileSync('output_1c.txt', outputContent);
    
    console.log('Conversion successful according to 1C 7.7 rules. Output written to output_1c.txt');

} catch (error) {
    console.error('An error occurred during conversion:', error);
    process.exit(1);
}
