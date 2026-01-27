/**
 * Конвертирует JavaScript-объект или массив в текстовый формат "СписокЗначений" 1С 7.7.
 *
 * @param {*} jsData - Входные данные JavaScript (объект или массив).
 * @returns {string} Сериализованная строка в формате 1С 7.7.
 * @throws {Error} Если корневой тип данных не поддерживается (не объект и не массив).
 */
function convertTo1C77Format(jsData) {

    /**
     * Экранирует двойные кавычки в строке для сериализации в 1С 7.7 (заменяет " на "").
     * @param {any} str - Значение, которое нужно преобразовать в строку и экранировать.
     * @returns {string} Экранированная строка.
     */
    const escapeString = (str) => String(str).replace(/"/g, '""');

    /**
     * Форматирует простое значение в полную сериализованную строку 1С 7.7.
     * Например: {"<тип>","0","0","0","0","0","<значение>"}
     * @param {string} type - Код типа 1С ('S', 'N', 'D').
     * @param {string} valueStr - Строковое представление значения.
     * @returns {string} Отформатированная строка значения.
     */
    const formatValue = (type, valueStr) => `{"${type}","0","0","0","0","0","${escapeString(valueStr)}"}`;

    /**
     * Рекурсивная вспомогательная функция для сериализации.
     * @param {*} currentJsValue - Текущее JavaScript-значение для сериализации.
     * @param {string} [keyContext=''] - Ключ текущего значения, используется для эвристики (например, определения даты по имени поля).
     * @returns {string} Фрагмент сериализованной строки 1С 7.7.
     */
    const serializeRecursive = (currentJsValue, keyContext = '') => {
        // Обработка примитивных типов и null
        if (currentJsValue === null) {
            return formatValue('S', ''); // В 1С 7.7 null часто обрабатывается как пустая строка
        }
        if (typeof currentJsValue === 'boolean') {
            return formatValue('N', currentJsValue ? '1' : '0');
        }
        if (typeof currentJsValue === 'number') {
            // Числа сериализуются как строки, с точкой в качестве десятичного разделителя.
            return formatValue('N', String(currentJsValue));
        }

        // Обработка строк с применением эвристики (даты, числовые строки)
        if (typeof currentJsValue === 'string') {
            // Эвристика для дат в формате ДД.ММ.ГГГГ
            if ((keyContext === 'DAT_KL' || keyContext === 'DAT_OD') && currentJsValue.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
                const [day, month, year] = currentJsValue.split('.');
                return formatValue('D', `${year}${month}${day}`);
            }
            // Эвристика для полей даты-времени ДД.ММ.ГГГГ ЧЧ:ММ:СС
            if (keyContext === 'DATE_TIME_DAT_OD_TIM_P' && currentJsValue.match(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}$/)) {
                 // В 1С 7.7 тип "Дата" не поддерживает время, поэтому сохраняем как строку, чтобы не потерять информацию.
                 return formatValue('S', currentJsValue);
            }
            // Эвристика для числовых строк (например, SUM, SUM_E)
            if ((keyContext === 'SUM' || keyContext === 'SUM_E') && !isNaN(parseFloat(currentJsValue))) {
                return formatValue('N', currentJsValue);
            }
            // По умолчанию - обычная строка
            return formatValue('S', currentJsValue);
        }

        // Обработка сложных типов (массивов и объектов)
        if (Array.isArray(currentJsValue)) {
            // Массив сериализуется как "СписокЗначений", где ключи - это индексы, начиная с 1.
            const items = currentJsValue.map((item, index) => {
                const serializedItem = serializeRecursive(item); // Рекурсивный вызов для элемента массива
                return `{${serializedItem},"${index + 1}"}`; // Формат {сериализованное_значение, "ключ"}
            }).join(',');
            return `{"VL",{${items}}}`; // Формат "СписокЗначений"
        }

        if (typeof currentJsValue === 'object' && currentJsValue !== null) {
            // Объект сериализуется как "СписокЗначений" с его ключами.
            const pairs = Object.entries(currentJsValue).map(([key, value]) => {
                const serializedValue = serializeRecursive(value, key); // Рекурсивный вызов для значения свойства объекта
                return `{${serializedValue},"${escapeString(key)}"}`; // Формат {сериализованное_значение, "ключ"}
            }).join(',');
            return `{"VL",{${pairs}}}`; // Формат "СписокЗначений"
        }

        // Резервный вариант для любых других неожиданных типов
        return formatValue('S', String(currentJsValue));
    };

    // Начало рекурсивной сериализации
    if (typeof jsData !== 'object' || jsData === null) {
        throw new Error("Неподдерживаемый корневой тип. Ожидался объект или массив.");
    }
    return serializeRecursive(jsData);
}

// Пример использования функции (этот блок должен быть в отдельном скрипте или в основной логике)
/*
const fs = require('fs');

try {
    const jsonInput = fs.readFileSync('prinvat.json', 'utf-8');
    const data = JSON.parse(jsonInput);
    
    const outputContent = convertTo1C77Format(data);
    
    fs.writeFileSync('output_1c.txt', outputContent, { encoding: 'utf-8' }); // Сохранение в UTF-8
    
    console.log('Конвертация выполнена успешно с использованием новой функции. Вывод записан в output_1c.txt');

} catch (error) {
    console.error('Произошла ошибка во время конвертации:', error);
    process.exit(1);
}
*/
