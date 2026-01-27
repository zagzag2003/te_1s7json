import sys
import json
import re

def convert_to_1c77_format(data):
    """
    Преобразует структуру данных Python (словарь или список) в текстовый формат 1С 7.7 "СписокЗначений".
    """

    def escape_string(s):
        """Экранирует двойные кавычки для формата 1С."""
        return str(s).replace('"', '""')

    def format_value(type_code, value_str):
        """Форматирует простое значение в конечную строку 1С."""
        return f'{{"{type_code}","0","0","0","0","0","{escape_string(value_str)}" }}'

    def serialize(value, key_context=''):
        """Рекурсивно сериализует Python-объект в строку формата 1С."""
        if value is None:
            return format_value('S', '')
        
        if isinstance(value, bool):
            return format_value('N', '1' if value else '0')

        if isinstance(value, (int, float)):
            return format_value('N', str(value))

        if isinstance(value, str):
            # Эвристика для дат "ДД.ММ.ГГГГ"
            if (key_context in ('DAT_KL', 'DAT_OD')) and re.match(r'^\d{2}\.\d{2}\.\d{4}$', value):
                day, month, year = value.split('.')
                return format_value('D', f'{year}{month}{day}')
            
            # Эвристика для числовых строк
            if key_context in ('SUM', 'SUM_E'):
                try:
                    float(value)  # Проверка, можно ли преобразовать в число
                    return format_value('N', value)
                except ValueError:
                    pass  # Если нет, будет обработано как обычная строка

            # Для всех остальных строк, включая дату-время
            return format_value('S', value)

        if isinstance(value, list):
            # Сериализация списка в СписокЗначений с ключами-индексами (начиная с 1)
            items = [f'{{{serialize(item)},"{i + 1}"}}' for i, item in enumerate(value)]
            return f'{{"VL",{{{",".join(items)}}}}}'

        if isinstance(value, dict):
            # Сериализация словаря в СписокЗначений
            pairs = [f'{{{serialize(v, k)},"{escape_string(k)}" }}' for k, v in value.items()]
            return f'{{"VL",{{{",".join(pairs)}}}}}'

        # Резервный вариант для других типов
        return format_value('S', str(value))

    # ---- Начало выполнения ----
    if not isinstance(data, (dict, list)):
        raise TypeError("Неподдерживаемый корневой тип. Ожидался словарь или список.")
        
    return serialize(data)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Ошибка: JSON-строка не передана в аргументах.", file=sys.stderr)
        print("Пример: python json_to_1c.py '<json_string>'", file=sys.stderr)
        sys.exit(1)

    json_input_str = sys.argv[1]

    try:
        # Загружаем данные из JSON-строки
        parsed_data = json.loads(json_input_str)
        # Конвертируем и выводим результат
        result = convert_to_1c77_format(parsed_data)
        print(result)
    except json.JSONDecodeError:
        print("Ошибка: Переданная строка не является валидным JSON.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Произошла непредвиденная ошибка: {e}", file=sys.stderr)
        sys.exit(1)
