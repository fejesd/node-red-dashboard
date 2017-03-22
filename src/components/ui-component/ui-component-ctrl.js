/* global angular */
/* global d3 */
angular.module('ui').controller('uiComponentController', ['$scope', 'UiEvents', '$interpolate', '$interval',
    function ($scope, events, $interpolate, $interval) {
        var me = this;

        if (typeof me.item.format === "string") {
            me.item.getText = $interpolate(me.item.format).bind(null, me.item);
        }

        if (typeof me.item.label === "string") {
            me.item.getLabel = $interpolate(me.item.label).bind(null, me.item);
        }

        me.init = function () {
            switch (me.item.type) {
                case 'button': {
                    me.buttonClick = function () {
                        me.valueChanged(0);
                    };
                    break;
                }

                case 'switch': {
                    me.switchClick = function () {
                        throttle({ id:me.item.id, value:!me.item.value }, 0);
                    };
                    break;
                }

                case 'dropdown': {
                    me.itemChanged = function () {
                        me.valueChanged(0);
                    };

                    // PL dropdown
                    // processInput will be called from main.js
                    // need to pass 'me' so that main may call 'me'
                    me.item.me = me;
                    me.processInput = function (msg) {
                        processDropDownInput(msg);
                    }
                    break;
                }

                case 'numeric': {
                    var changeValue = function (delta) {
                        if (delta > 0) {
                            if (me.item.value < me.item.max) {
                                me.item.value = Math.round(Math.min(me.item.value + delta, me.item.max)*10000)/10000;
                            }
                        } else if (delta < 0) {
                            if (me.item.value > me.item.min) {
                                me.item.value = Math.round(Math.max(me.item.value + delta, me.item.min)*10000)/10000;
                            }
                        }
                    };

                    var range = me.item.max - me.item.min;
                    var promise = null;
                    me.periodicChange = function (delta) {
                        changeValue(delta);
                        var i = 0;
                        promise = $interval(function () {
                            i++;
                            if (i > 75) { changeValue( delta * 250); }
                            else if (i > 50) { changeValue( delta * 50); }
                            else if (i > 35) { changeValue(delta * 10); }
                            else if (i > 25) { changeValue(delta * 2); }
                            else if (i > 15) { changeValue(delta); }
                            else if (i > 5 && i % 2) { changeValue(delta); }
                        }, 100);
                    };
                    me.stopPeriodic = function () {
                        if (promise) {
                            $interval.cancel(promise);
                            promise = null;
                            me.valueChanged(0);
                        }
                    };
                    break;
                }

                case 'chart': {
                    me.item.theme = $scope.main.selectedTab.theme;
                    break;
                }

                case 'colour-picker': {
                    me.item.me = me;
                    if ((me.item.width < 4) || (!me.item.showValue && !me.item.showPicker)) {
                        me.item.showPicker = false;
                        me.item.showValue = false;
                        me.item.showSwatch = true;
                    }
                    if (me.item.showPicker) {
                        if (me.item.height < 4) {
                            me.item.height = ((me.item.showSwatch || me.item.showValue) ? 4 : 3);
                        }
                    }
                    me.item.options = {
                        format: me.item.format,
                        inline: me.item.showPicker,
                        alpha: me.item.showAlpha,
                        lightness: me.item.showLightness,
                        swatch: me.item.showSwatch,
                        swatchOnly: (me.item.width < 2 || !(me.item.showValue)),
                        swatchPos: "right",
                        pos: "bottom right",
                        case: "lower",
                        round: true,
                        pickerOnly: me.item.showPicker && !(me.item.showSwatch || me.item.showValue)
                    };
                    me.item.key = function (event) {
                        if ((event.charCode === 13) || (event.which === 13)) {
                            events.emit({ id:me.item.id, value:me.item.value });
                            if (me.api) { me.api.close(); }
                        }
                    }
                    me.item.eventapi = {
                        onChange: function(api,color,$event) {
                            if ($event === undefined) { return; }
                            me.valueChanged(0);
                        },
                        onOpen: function(api,color) {
                            me.api = api;
                        }
                    }
                    break;
                }

                case 'date-picker': {
                    if (me.item.ddd !== undefined) {
                        if (typeof me.item.ddd !== "object") {
                            var b = me.item.ddd.split(/\D+/);
                            me.item.ddd = new Date(Date.UTC(b[0], --b[1], b[2], b[3], b[4], b[5], b[6]));
                        }
                    }
                    me.processInput = function (msg) {
                        msg.value = new Date(msg.value);
                        me.item.ddd = msg.value;
                    };
                    me.setDate = function () {
                        me.item.value = me.item.ddd;
                        me.valueChanged(0);
                    };
                    me.item.me = me;
                    break;
                }

                case 'form': {
                    me.stop = function(event) {
                        if ((event.charCode === 13) || (event.which === 13)) {
                            event.preventDefault();
                            event.stopPropagation();
                        }
                    }
                    me.submit = function () {
                        me.item.value = JSON.parse(JSON.stringify(me.item.formValue));
                        me.valueChanged(0);
                        me.reset();
                    };
                    me.reset = function () {
                        for (var x in me.item.formValue) {
                            if (typeof (me.item.formValue[x]) === "boolean") {
                                me.item.formValue[x] = false;
                            }
                            else {
                                me.item.formValue[x] = "";
                            }
                        }
                        $scope.$$childTail.form.$setUntouched();
                        $scope.$$childTail.form.$setPristine();
                    };
                }
            }
        }

        me.valueChanged = function (throttleTime) {
            throttle({ id:me.item.id, value:me.item.value },
                typeof throttleTime === "number" ? throttleTime : 10);
        };

        // will emit me.item.value when enter is pressed
        me.keyPressed = function (event) {
            if ((event.charCode === 13) || (event.which === 13)) {
                events.emit({ id:me.item.id, value:me.item.value });
            }
        }

        var timer;
        var throttle = function (data, timeout) {
            if (timeout === 0) {
                events.emit(data);
                return;
            }

            if (timer) {
                clearTimeout(timer);
            }
            timer = setTimeout(function () {
                timer = undefined;
                events.emit(data);
            }, timeout);
        };

        // may add additional input processing for other controls
        var processDropDownInput = function (msg) {
            // options should have the correct format see beforeEmit in ui-dropdown.js
            if (msg && msg.isOptionsValid) {
                me.item.options = msg.newOptions;
                // delete items passed to me (may as well just keep them)
                delete me.item.isOptionsValid;
                delete me.item.newOptions;
            }
        };

    }]);
