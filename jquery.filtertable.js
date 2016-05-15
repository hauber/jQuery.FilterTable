/**
 * jquery.filterTable
 *
 * This plugin will add a search filter to tables. When typing in the filter,
 * any rows that do not contain the filter will be hidden.
 *
 * Utilizes bindWithDelay() if available. https://github.com/bgrins/bindWithDelay
 *
 * @version v1.5.5
 * @author Sunny Walker, swalker@hawaii.edu
 * @license MIT
 */
(function($) {
    $.expr[':'].filterTableFind = jQuery.expr.createPseudo(function (arg) {
        return function (el) {
            var regexPattern = "^/(.+)/(\w*)$";
            var isRegex = arg.match(regexPattern);
            var checker;
            if (isRegex) {
                checker = new RegExp(isRegex[1], isRegex[2]);
            } else {
                checker = new RegExp(arg, 'i');
            }
            // console.log(arg + " -[2]-> " + checker);
            return checker.test($(el).text());
            };
        });
        $.expr[':'].filterTableFindAny = jQuery.expr.createPseudo(function(arg) {
            // build an array of each non-falsey value passed
            var raw_args = arg.split(/[\s,]/),
                args = [];
            $.each(raw_args, function(i, v) {
                var t = v.replace(/^\s+|\s$/g, ''); // trim the string
                if (t) {
                    args.push(t);
                }
            });
            // if there aren't any non-falsey values to search for, abort
            if (!args.length) {
                return false;
            }
            return function(el) {
                var found = false;
                $.each(args, function(i, v) {
                    if ($(el).text().toUpperCase().indexOf(v.toUpperCase()) >= 0) {
                        found = true;
                        return false; // short-circuit the searching since this cell has one of the terms
                    }
                });
                return found;
            };
        });
        $.expr[':'].filterTableFindAll = jQuery.expr.createPseudo(function(arg) {
            // build an array of each non-falsey value passed
            var raw_args = arg.split(/[\s,]/),
                args = [];
            $.each(raw_args, function(i, v) {
                var t = v.replace(/^\s+|\s$/g, ''); // trim the string
                if (t) {
                    args.push(t);
                }
            });
            // if there aren't any non-falsey values to search for, abort
            if (!args.length) {
                return false;
            }
            return function(el) {
                var found = 0; // how many terms were found?
                $.each(args, function(i, v) {
                    if ($(el).text().toUpperCase().indexOf(v.toUpperCase()) >= 0) {
                        found++; // found another term
                    }
                });
                return found === args.length; // did we find all of them in this cell?
            };
        });

    $.fn.filterTable = function(options) { // define the filterTable plugin
        var defaults = { // start off with some default settings
                autofocus:         false,               // make the filter input field autofocused (not recommended for accessibility)
                callback:          null,                // callback function: function(term, table){}
                containerClass:    'filter-table',      // class to apply to the container
                containerTag:      'p',                 // tag name of the container
                filterExpression:  'filterTableFind',   // jQuery expression method to use for filtering
                hideTFootOnFilter: false,               // if true, the table's tfoot(s) will be hidden when the table is filtered
                highlightClass:    'alt',               // class applied to cells containing the filter term
                ignoreClass:       '',                  // don't filter the contents of cells with this class
                ignoreColumns:     [],                  // don't filter the contents of these columns
                inputSelector:     null,                // use the element with this selector for the filter input field instead of creating one
                inputName:         '',                  // name of filter input field
                inputType:         'search',            // tag name of the filter input tag
                label:             'Filter:',           // text to precede the filter input tag
                minChars:          1,                   // filter only when at least this number of characters are in the filter input field
                minRows:           8,                   // don't show the filter on tables with at least this number of rows
                placeholder:       'search this table', // HTML5 placeholder text for the filter field
                preventReturnKey:  true,                // prevent the return key in the filter input field from trigger form submits
                quickList:         [],                  // list of phrases to quick fill the search
                quickListClass:    'quick',             // class of each quick list item
                quickListGroupTag: '',                  // tag surrounding quick list items (e.g., ul)
                quickListTag:      'a',                 // tag type of each quick list item (e.g., a or li)
                visibleClass:      'visible'            // class applied to visible rows
            },
            hsc = function(text) { // mimic PHP's htmlspecialchars() function
                return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            },
            settings = $.extend({}, defaults, options); // merge the user's settings into the defaults

        var doFiltering = function(table, q) { // handle the actual table filtering
                var tbody = table.find('tbody'); // cache the tbody element
                if (q === '' || q.length < settings.minChars) { // if the filtering query is blank or the number of chars is less than the minChars option
                    tbody.find('tr').show().addClass(settings.visibleClass); // show all rows
                    tbody.find('td').removeClass(settings.highlightClass); // remove the row highlight from all cells
                    if (settings.hideTFootOnFilter) { // show footer if the setting was specified
                        table.find('tfoot').show();
                    }
                } else { // if the filter query is not blank
                    var all_tds = tbody.find('td');
                    tbody.find('tr').hide().removeClass(settings.visibleClass); // hide all rows, assuming none were found
                    all_tds.removeClass(settings.highlightClass); // remove previous highlights
                    if (settings.hideTFootOnFilter) { // hide footer if the setting was specified
                        table.find('tfoot').hide();
                    }
                    if (settings.ignoreColumns.length) {
                        var tds;
                        if (settings.ignoreClass) {
                            all_tds = all_tds.not('.'+settings.ignoreClass);
                        }
                        tds = all_tds.filter(':'+settings.filterExpression+'("'+q.replace(/(['"])/g, '\\$1')+'")');
                        tds.each(function() {
                            var t = $(this),
                                col = t.parent().children().index(t);
                            //window.console.log(t.text(), col);
                            if ($.inArray(col, settings.ignoreColumns) === -1) {
                                //window.console.log(t.text(), $.inArray(col, settings.ignoreColumns));
                                t.addClass(settings.highlightClass).closest('tr').show().addClass(settings.visibleClass);
                            }
                        });
                    } else {
                        if (settings.ignoreClass) {
                            all_tds = all_tds.not('.'+settings.ignoreClass);
                        }

                        // filter: term +term -term
                        // executed in sequence
                        // term = include, search only visible rows
                        // -term = exclude, search only visible rows
                        // +term = include, search whole table
                        var raw_args = q.split(/[\s,]/);
                        $.each(raw_args, function (i, v) {
                        var t = v.trim();
                            if (t) {
                            if (i == 0) { // first match is a "global include" by default (i. e. prepended by "+")
                                if (!t.match(/^[+-]/)) {
                                    t = "+" + t;
                                }
                            }
                            var filterArgument = t;
                            var prefix = "";
                            if (filterArgument.match(/^[+-]/)) {
                                prefix = filterArgument[0];
                                filterArgument = filterArgument.substr(1);
                            }
                            var filterArgumentAsString = filterArgument.replace(/(['"])/g, '\\$1');
                            // console.log(t + " -[1]-> " + filterArgument);
                            var filterExpression = ':filterTableFind("' + filterArgumentAsString + '")'; // replaced by filterFunction
                            var filterFunction = function (i, el) {
                                var regexPattern = "^/(.+)/(\w*)$";
                                var isRegex = filterArgument.match(regexPattern);
                                var checker;
                                if (isRegex) {
                                    checker = new RegExp(isRegex[1], isRegex[2]);
                                } else {
                                    checker = new RegExp(filterArgument, 'i');
                                }
                                // console.log(filterArgument + " -[2]-> " + checker);
                                return checker.test($(el).text());
                            };
                            if (prefix === '-' && filterArgument.length > 0) { // exclude from visible rows
                                    var visible_tds_for_removal = tbody.find('tr.' + settings.visibleClass).find('td');
                                    if (settings.ignoreClass) {
                                        visible_tds_for_removal = visible_tds_for_removal.not('.' + settings.ignoreClass);
                                    }
                                visible_tds_for_removal.filter(filterFunction).addClass(settings.highlightClass).closest('tr').hide().removeClass(settings.visibleClass);
                            } else if (prefix === '+' && filterArgument.length > 0) { // include rows (global)
                                // TODO: exclude settings.ignoreClass
                                all_tds.filter(filterFunction).addClass(settings.highlightClass).closest('tr').show().addClass(settings.visibleClass);
                                } else { // constrain visible rows
                                    var visible_trs = tbody.find('tr.' + settings.visibleClass);
                                    var visible_tds = visible_trs.find('td');
                                    if (settings.ignoreClass) {
                                        visible_tds = visible_tds.not('.' + settings.ignoreClass);
                                    }
                                var matched_trs = visible_tds.filter(filterFunction).addClass(settings.highlightClass).closest('tr');
                                    visible_trs.not(matched_trs).hide().removeClass(settings.visibleClass);
                                }
                            }
                        });
                    }
                }
                if (settings.callback) { // call the callback function
                    settings.callback(q, table);
                }
            }; // doFiltering()

        return this.each(function() {
            var t = $(this), // cache the table
                tbody = t.find('tbody'), // cache the tbody
                container = null, // placeholder for the filter field container DOM node
                quicks = null, // placeholder for the quick list items
                filter = null, // placeholder for the field field DOM node
                created_filter = true; // was the filter created or chosen from an existing element?
            if (t[0].nodeName === 'TABLE' && tbody.length > 0 && (settings.minRows === 0 || (settings.minRows > 0 && tbody.find('tr').length >= settings.minRows)) && !t.prev().hasClass(settings.containerClass)) { // only if object is a table and there's a tbody and at least minRows trs and hasn't already had a filter added
                if (settings.inputSelector && $(settings.inputSelector).length === 1) { // use a single existing field as the filter input field
                    filter = $(settings.inputSelector);
                    container = filter.parent(); // container to hold the quick list options
                    created_filter = false;
                } else { // create the filter input field (and container)
                    container = $('<'+settings.containerTag+' />'); // build the container tag for the filter field
                    if (settings.containerClass !== '') { // add any classes that need to be added
                        container.addClass(settings.containerClass);
                    }
                    container.prepend(settings.label+' '); // add the label for the filter field
                    filter = $('<input type="'+settings.inputType+'" placeholder="'+settings.placeholder+'" name="'+settings.inputName+'" />'); // build the filter field
                    if (settings.preventReturnKey) { // prevent return in the filter field from submitting any forms
                        filter.on('keydown', function(ev) {
                            if ((ev.keyCode || ev.which) === 13) {
                                ev.preventDefault();
                                return false;
                            }
                        });
                    }
                }
                if (settings.autofocus) { // add the autofocus attribute if requested
                    filter.attr('autofocus', true);
                }
                if ($.fn.bindWithDelay) { // does bindWithDelay() exist?
                    filter.bindWithDelay('keyup', function() { // bind doFiltering() to keyup (delayed)
                        doFiltering(t, $(this).val());
                    }, 200);
                } else { // just bind to onKeyUp
                    filter.bind('keyup', function() { // bind doFiltering() to keyup
                        doFiltering(t, $(this).val());
                    });
                } // keyup binding block
                filter.bind('click search input paste blur', function() { // bind doFiltering() to additional events
                    doFiltering(t, $(this).val());
                });
                if (created_filter) { // add the filter field to the container if it was created by the plugin
                    container.append(filter);
                }
                if (settings.quickList.length>0) { // are there any quick list items to add?
                    quicks = settings.quickListGroupTag ? $('<'+settings.quickListGroupTag+' />') : container;
                    $.each(settings.quickList, function(index, value) { // for each quick list item...
                        var q = $('<'+settings.quickListTag+' class="'+settings.quickListClass+'" />'); // build the quick list item link
                        var screen = settings.quickList.fullName.get(value);
                        var processing = settings.quickList.regex.get(value);
                        var tooltip = settings.quickList.tooltip.get(value);
                        q.text(hsc(screen)); // add the item's text
                        if (q[0].nodeName === 'A') {
                            q.attr('href', '#'); // add a (worthless) href to the item if it's an anchor tag so that it gets the browser's link treatment
                            q.attr('title', tooltip);
                        }
                        q.bind('click', function(e) { // bind the click event to it
                            e.preventDefault(); // stop the normal anchor tag behavior from happening

                            // modifier key presence as boolean values: altKey, ctrlKey, shiftKey; use true is no key is required
                            var key_add = e.altKey,
                                key_subtract = e.shiftKey,
                                key_add_global = key_add && key_subtract,
                                key_start_new = true;

                            // how to cope with old filter entry
                            var old_value,
                                separator,
                                empty;

                            if (key_start_new && !key_add && !key_subtract && !key_add_global) { // remove old content
                                old_value = "";
                            } else {
                                old_value = filter.val().trim();
                            }
                            empty = old_value.length === 0;
                            separator = empty ? "" : " ";

                            // actions (the first match wins)
                            if (key_add_global) {
                                separator += "+";
                            } else if (key_subtract) {
                                separator += "-";
                                if (empty) { // fix such that subtract will work also as first entry
                                    old_value = ".";
                                }
                                }
                            filter.val(old_value + separator + processing + " ").focus().trigger('click');
                        });
                        quicks.append(q); // add the quick list link to the quick list groups container
                    }); // each quick list item
                    if (quicks !== container) {
                        container.append(quicks); // add the quick list groups container to the DOM if it isn't already there
                    }
                } // if quick list items
                if (created_filter) { // add the filter field and quick list container to just before the table if it was created by the plugin
                    t.before(container);
                }
            } // if the functionality should be added
        }); // return this.each
    }; // $.fn.filterTable
})(jQuery);
