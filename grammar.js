// From https://github.com/publicodes/publicodes/blob/6ee8c5d2316c8099931504b401feaaabd22b89c8/packages/core/source/grammar.ne#L17C6-L19
const letter = /[a-zA-Z\u00C0-\u017F]/;
const symbol = prec(0, /[',°€%²$_’"«»]/); // TODO: add parentheses
const digit = /\d/;

const number = /\d+(\.\d+)?/;
const date = /(?:(?:0?[1-9]|[12][0-9]|3[01])\/)?(?:0?[1-9]|1[012])\/\d{4}/;
const exposant = /[⁰-⁹]+/;
const any_char = choice(letter, symbol, digit);
const any_char_or_special_char = choice(any_char, /\-|\+/);

const phrase_starting_with = (char) =>
    seq(
        seq(char, repeat(any_char_or_special_char)),
        repeat(seq(" ", seq(any_char, repeat(any_char_or_special_char))))
    );

const rule_name = token(phrase_starting_with(letter));

const unit_symbol = /[°%\p{Sc}]/; // °, %, and all currency symbols (to be completed?)
const unit_identifier = token.immediate(
    phrase_starting_with(choice(unit_symbol, letter))
);

const space_indent = / {2}/;
const tab_indent = /\t/;
const indent = choice(space_indent, tab_indent);
const dedent = token.immediate(seq(indent, optional(/\n/)));

const indentedBlock = (rule) => {
    return seq(indent, repeat1(rule), optional(dedent));
};

/* eslint-disable arrow-parens */
/* eslint-disable camelcase */
/* eslint-disable-next-line spaced-comment */
/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
    name: "publicodes",

    extras: ($) => [/[\s\f\uFEFF\u2060\u200B]/, /\r?\n/, $.comment],
    inline: ($) => [$.constant],

    // FIXME: issue with boolean and identifier
    word: ($) => $.name,

    rules: {
        source_file: ($) => repeat(choice($.rule, $._empty)),

        rule: ($) =>
            seq(
                $._dottedName,
                ":",
                choice(
                    field("body", $.rule_body),
                    field("value", $._expression),
                    $._empty
                )
            ),

        rule_body: ($) => indentedBlock($._statement),

        _statement: ($) => choice($.mechanism),

        mechanism: ($) => choice($.valeur, $.somme),

        valeur: ($) => seq("valeur", ":", $._expression),

        somme: ($) =>
            prec.left(
                seq("somme", ":", indentedBlock(seq("-", $._expression)))
            ),

        /*
        ==============================
            Expressions
        =============================
        */
        _expression: ($) => seq(choice($.constant, $._ar_expression)),

        _ar_expression: ($) =>
            choice(
                $.ar_unary_expression,
                $.ar_binary_expression,
                seq(token(prec(2, "(")), $._ar_expression, token(prec(2, ")"))),
                $.number,
                alias($._dottedName, $.reference)
            ),

        ar_unary_expression: ($) => prec(3, seq(/- ?/, $._ar_expression)),

        ar_binary_expression: ($) =>
            choice(
                // TODO : power of
                prec.left(
                    2,
                    seq(
                        $._ar_expression,
                        token(prec(2, choice(" * ", " / "))),
                        $._ar_expression
                    )
                ),
                prec.left(
                    1,
                    seq(
                        $._ar_expression,
                        token(prec(2, choice(" + ", " - "))),
                        $._ar_expression
                    )
                )
            ),

        constant: ($) => choice($.true, $.false, $.string, $.date),
        /*
        ===================
            Identifier
        ===================
        */
        _dottedName: ($) => seq($.name, repeat(seq(" . ", $.name))),
        name: ($) => rule_name,
        /*
        ===================
            Various
        ===================
        */

        _empty: (_) => /(\r|\s)*\n/,
        comment: (_) => /#.*/,

        /*
        ===================
            Constants
        ===================
*/
        boolean: ($) => /oui|non/,
        true: (_) => "oui",
        false: (_) => "non",

        string: (_) => /'.*?'/,

        date: () => date,
        // TODO: may want to distinguish between integers and floats
        number: ($) => seq(number, optional($.units)),
        units: ($) =>
            seq(
                field("numerators", seq(optional(" "), $._units)),
                field("denominators", repeat(seq("/", $._units)))
            ),
        _units: ($) => seq($.unit, repeat(seq(".", $.unit))),
        unit: ($) => seq(unit_identifier, optional($.exposant)),
        exposant: () => exposant,
    },
});

/* Questions : 
- Should we enforce a space between operators and operands? 
    -> YES because it is easier to read and because it enable to disambiguate between unit (12 €/an) and division (12 € / an)
- If so, should we allow for operator symbol to appear in words (ex : "a . a+") 
    -> NO because it is not a common practice and it would make the grammar more complex

- Should we allow for multiple spaces between operators, operands, words, etc? 
    -> YES because it is a common practice and it makes the grammar more flexible 
        (That's what copilot is saying anyway)
        TO CHECK WITH TEST
*/
