import sys
import json
import re
import argparse
import os

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
            if re.match(r'^\d{2}\.\d{2}\.\d{4}$', value):
                day, month, year = value.split('.')
                return format_value('D', f'{year}{month}{day}')
            
            # Эвристика для числовых строк
            try:
                if value.strip() == '': raise ValueError
                float(value)  # Проверка, можно ли преобразовать в число
                return format_value('N', value)
            except (ValueError, TypeError):
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
    parser = argparse.ArgumentParser(description="Конвертирует JSON-файл в формат 1С 7.7 'СписокЗначений'.")
    parser.add_argument("input_file", help="Путь к входному JSON-файлу.")
    parser.add_argument("-o", "--output_file", help="Путь к выходному файлу. Если не указан, вывод будет направлен в консоль.")

    args = parser.parse_args()

    if not os.path.exists(args.input_file):
        print(f"Ошибка: Входной файл '{args.input_file}' не найден.", file=sys.stderr)
        sys.exit(1)

    try:
        with open(args.input_file, 'r', encoding='utf-8') as f:
            json_content = f.read()
        
        parsed_data = json.loads(json_content)
        result = convert_to_1c77_format(parsed_data)

        if args.output_file:
            with open(args.output_file, 'w', encoding='utf-8') as outfile:
                outfile.write(result)
            print(f"Результат сохранен в файл '{args.output_file}'", file=sys.stderr)
        else:
            print(result)

    except json.JSONDecodeError:
        print(f"Ошибка: Файл '{args.input_file}' содержит невалидный JSON.", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        # Это должно быть перехвачено os.path.exists, но на всякий случай
        print(f"Ошибка: Входной файл '{args.input_file}' не найден.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Произошла непредвиденная ошибка: {e}", file=sys.stderr)
        sys.exit(1)
