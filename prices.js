(function() {

	function Prices() {

		this.init = function() {

			this.data = window.prices_data;
			window.prices_data = [];

			this.canvas = $('canvas').getContext('2d');
			this.window_resize = Event.on(window, 'resize', function() { window.prices.lazy_refresh(); })
			$('canvas').on('click', function(e) { prices.onclick(e); } );


			var highlight = 'Beijing,Budapest,London,New York,Sydney,Tokyo,Zurich'
			var colors = 'e00000,e0e000,00ff00'

			var set_highlights = function(x) { var res = {}; x.split(',').each(function(a) { res[a] = 1; }); return res; }
			var set_colors = 

			this.state = {
				update: function(items) { for (var k in items) this[k] = items[k]; return this; }, 

				charts: [], 
				default_charts: [0, 1], 
				sort_index: 1, 
				highlight: set_highlights(highlight), 
				colormap: colors.split(',').map(function(a) { return a.match(/.{2}/g).map(function(b) { return parseInt(b, 16); }); }), 
				background: '#111', 
				textcolor: '#fff', 

				// charts where color map should be reverted (any charts with costs)
				chart_properties: {
					'prices': 1, 
					'time_to_buy': 1, 
					'monthly_costs': 1, 
					'food': 1, 
					'clothing': 1, 
					'electronics': 1, 
					// this chart has several extremely high values which flatten regular values, so set custom scaling
					'rents': { max: 7000, max_exclude: {'local_prices': 1} }, 
					'transport': 1, 
					'cars': 1, 
					'restaurants': 1, 
					'city_break': 1, 
					'services': 1, 
					'taxes': 1, 
					'exchange_rates': 1, 
					'inflation': 1
				}, 

				metrics: {
					canvas: { x: 600, y: 600, mx: 1200, my: 750 }, 
					base: { x: 5, y: 0 }, 
					text: { x: 2, y: 3 }, 
					chart_width: 120, 
					name_height: 15, 
					field_height: 15, 
					stepy: 10, 
					stepy_lowest: 5
				}
			}

			this.setup_chart_list()
			this.lazy_refresh(50)

		}

		this.refresh = function() {
			var start = new Date(), 
				size = this.state.metrics.canvas, 
				canvas = $('canvas'), 
				x = canvas.offsetLeft, y = canvas.offsetTop, stepy

			// available width, assuming a centered canvas
			canvas.width = size.w = Math.max(size.x, document.viewport.getWidth() - x - 2)
			// available height, minus a constant 5 to avoid scrolling (chrome)
			canvas.height = size.h = Math.max(size.y, document.viewport.getHeight() - y - 5)
			// less height than ideal? adjust stepy
			stepy = canvas.height < this.state.metrics.canvas.my ? this.int(10 * canvas.height / this.state.metrics.canvas.my) : 10
			this.state.metrics.stepy = Math.max(stepy, this.state.metrics.stepy_lowest)

			this.update_hash()
			this.draw_charts()
			this.debug('refresh at ' + start.toLocaleString() + ' in ' + ((new Date()).getTime() - start.getTime()) / 1000 + ' seconds')
		}

		this.lazy_refresh = function(time) {
			if (this.last_resize_id) clearTimeout(this.last_resize_id)
			this.last_resize_id = setTimeout(function() { prices.refresh(); }, time || 500)
		}


		this.onclick = function(e) {
			for (var i = 0; i < this.click_handlers.length; i++) 
				if (this.click_handlers[i].apply(this, [e, { x: e.offsetX, y: e.offsetY }, this.state.metrics])) break
		}

		this.click_handlers = [
			// click on lines
			function (event, p, m) {
				var range = m.base.y + m.name_height + m.field_height + m.stepy * 0.5
				if (p.y < range) return false
				var i = this.int((p.y - range) / m.stepy)
				i = this.state.cities[i]
				this.state.highlight[i] = !this.state.highlight[i]
				this.lazy_refresh(10)
				return true
			}, 
			// click on column headers
			function (event, p, m) {
				var range = [m.base.y + m.text.y + m.name_height, m.field_height]
				if (p.y < range[0] || p.y > range[0] + range[1]) return false
				var i = this.int((p.x - m.base.x) / m.chart_width) // which column was clicked
				this.state.sort_index = i * (this.state.sort_index === i ? -1 : 1)
				this.lazy_refresh(10)
				return true
			}
		]


		this.update_hash = function() {
			window.location.hash = this.state.charts.join(',') + ',order:' + this.state.sort_index
		}

		this.read_hash = function() {
			// list of charts, filter empty strings
			var hash = window.location.hash.slice(1).split(',').filter(Prototype.K)

			// grab sorting order, if set
			if (hash.length && hash[hash.length - 1].slice(0, 6) === 'order:') this.state.sort_index = this.int(hash.pop().slice(6))

			// set active charts
			this.state.charts = hash.length ? hash : this.state.default_charts.map(function(a) { return this[a][0]; }, this.chart_list)			
		}

		this.update_chart_list = function(time) {
			this.state.charts = $A($('chart_list').childNodes).slice(1).
				filter(function(x) { return x.hasClassName('active'); }).
				map(function(x) { return x.value; })
			this.lazy_refresh(time)
		}

		this.setup_chart_list = function() {

			// full chart list
			this.chart_list = this.data.charts.concat(this.data.profession.map(function(x) { return [x, 'Income for ' + x.replace('_', ' ')]; }))
			// get active charts and sort index from the hash (or set default ones)
			this.read_hash()

			var first_line = ['', '\u25bc \u25bc \u25bc Select more charts \u25bc \u25bc \u25bc'], 
				chart_onclick = function(e) { return this.toggleClassName('active') && prices.update_chart_list.apply(prices); }

			var add_chart = function(chart, i) {
				var el = document.createElement('div')
				el.value = chart[0]
				el.innerHTML = chart[1]
				el.className = (i && this.active_charts.indexOf(el.value) > -1) ? 'active' : ''
				if (i) el.onclick = chart_onclick
				this.list.appendChild(el)
			}

			// populate #chart_list with chart elements
			Prototype.K([first_line].concat(this.chart_list)).each(add_chart, { list: $('chart_list'), active_charts: this.state.charts })
		}

		this.draw_charts = function() {
			var m = this.state.metrics, bx = m.base.x, by = m.base.y, tx = bx + m.text.x, ty = by + m.text.y, width = m.chart_width

			var colormap = this.state.colormap, context, tmp

			var data = this.charts_data(this.state.charts), 
				charts = data[0], 
				fields = data[1]

			data = this.sort_by(data[2], this.state.sort_index)

			this.state = this.state.update({
				charts: charts.map(function(a) { return a[1]; }), 
				fields: fields, 
				cities: data.map(function(x) { return x[0]; })
			})

			var isnumber = function(x) { return !isNaN(parseInt(x, 10)); }
			var getmax = function(list, k) { return $A(list.map(function(x) { return x[k]; })).max(); }

			var display_name = function(el, i) {
				this.p.label.apply(this.p, [tx + this.c * width, ty, el[2]]);
				this.c += el[0]
			}

			var display_field = function(el, i) {
				var x = i * width, y = m.name_height
				this.canvas.fillStyle = this.state.background
				this.canvas.fillRect(bx + x, by + y, m.text.x * 2 + this.canvas.measureText(el[2]).width, m.text.y + m.stepy + 6)
				this.label(tx + x, ty + y, el[2]);
			}

			var display_city = function(el, i) {
				var by = m.base.y + m.name_height + m.field_height
				var highlighted = this.state.highlight[el[0]]
				if (highlighted) 
					this.bar(bx, by + (i + 1) * m.stepy, m.stepy, m.chart_width, '#333', el[0], m.chart_width, '#fff');
				else 
					this.label(tx, by + (m.stepy - 10) + m.text.y + i * m.stepy, el[0], '#fff');
			}

			var display_value = function(el, i) {
				var value = el[this.index], 
					mark = this.p.state.highlight[el[0]], 
					color = this.p.color_map(colormap, this.reverse ? -value : value, this.max), 
					method = this.max ? this.p.bar : this.p.label, 
					args = this.max ? // bar or text?
						[this.bx, this.by + i * m.stepy, m.stepy, (width - 5) * value / this.max, '#' + color, value, width - 5, 0, mark] : 
						[this.bx + m.text.x, this.by + m.text.y + i * m.stepy, value, this.p.state.textcolor]
				method.apply(this.p, args)
			}

			this.draw([
				['font', 'normal ' + (m.stepy + 1) + 'px verdana'], 
				['textBaseline', 'top'], 
				['fillStyle', this.state.background], 
				['fillRect', 0, 0, m.canvas.w, m.canvas.h], 
				['fillStyle', this.state.textcolor]
			]);

			charts.each(display_name, { p: this, c: 1 })
			fields.each(display_field, this)
			data.each(display_city, this)

			var props

			for (var k = 1; k < fields.length; k++) {
				if (k * m.chart_width > m.canvas.w) break // render only visible columns
				props = this.state.chart_properties[fields[k][0]] || { reverse: 0 }
				if (typeof props !== 'object') props = {}
				context = {
					p: this, 
					index: k, 
					// get max value for number-type columns (if a max is defined in props, use that)
					max: (tmp = isnumber(data[0][k])) ? (props.max && !props.max_exclude[fields[k][1]] ? props.max : getmax(data, k)) : 0, 
					// 
					bx: m.base.x + k * width, 
					by: m.base.y + m.name_height + m.field_height + (tmp ? m.stepy : 0), 
					reverse: props.reverse === undefined || props.reverse
				}
				data.each(display_value, context)
			}
		}


		// get data for each chart (cities are in the same order everywhere)
		this.charts_data = function(names) {
			var charts = [], fields = [], data = [], k, tmp

			// put city names into data first
			fields.push(['city', 'city', 'City'])
			data = this.data.city.slice(1).map(function(x) { return [x[0]]; })

			// fields from each chart
			for (k = 0; k < names.length; k++) {
				if (typeof names[k] !== 'string') names[k] = names[k][1]
				tmp = this.chart_data(names[k])
				charts.push(tmp[0])
				fields = fields.concat(tmp[1])
				data = this.merge(data, tmp[2])
			}

			return [charts, fields, data]
		}

		this.chart_data = function(name) {
			var i, fname, len, city_fields = this.data.city[0], city_number = this.data.city.length - 1
			var chart, fields = [], data = [], indexes

			if ((indexes = this.data.profession.indexOf(name)) > -1) {
				// wage charts
				chart = 'Income for ' + name.replace('_', ' ')
				indexes = indexes * city_number + 1 // wages for the x-th profession
				fields = this.data.wage[0].map(function(x) { return [name].concat(x); }) // wage fields
				data = this.data.wage.slice(indexes, indexes + city_number) // wages for each city
			} else {
				// city charts
				chart = this.data.charts.filter(function(x) { return x[0] === name; })[0][1]
				fname = name + '.';
				len = fname.length
				indexes = -1

				// look up fields of this chart
				for (i = 0; i < city_fields.length; i++) {
					if ((tmp = city_fields[i].slice(0, len) === fname) && indexes == -1) indexes = i
					else if (!tmp && indexes > -1) break
				}

				tmp = [indexes, i]; // relevant field indexes for this chart
				indexes = function(x) { return x.slice(tmp[0] + 1, tmp[1] + 1); }; // slicer method for these fields
				fields = city_fields.slice(tmp[0], tmp[1]).map(function(x) { return x.split('.'); }); // add field names
				data = this.data.city.slice(1).map(indexes); // add the relevant fields from each city
			}

			return [[fields.length, name, chart], fields, data]
		}


		this.draw = function(list) {
			var func
			if (typeof list === 'string') list = [list];
			for (var k = 0; k < list.length; k++) {
				if (typeof list[k] == 'string') list[k] = list[k].split(',')
				func = list[k].shift();
				list[k] = typeof this.canvas[func] == "function" ? 
					this.canvas[func].apply(this.canvas, list[k]) : 
					this.canvas[func] = list[k][0];
			}
			return list
		}

		this.label = function(x, y, text, color) {
			this.canvas.fillStyle = color ? (color[0] === '#' ? color : '#' + color) : this.state.textcolor
			this.canvas.fillText(text, x, y)
		}

		this.bar = function(x, y, w, len, color, text, max, textcolor, highlighted) {
			len = Math.abs(len)

			// some charts allow overextending bars (extreme long values, truncated)
			var long = len > max ? this.int(len / max * 100) : 0
			if (long) len = max

			// decide if text fits into the bar or should go outside
			var width = this.canvas.measureText(text).width, outside = width > (len - 3)

			// draw colored bar
			this.draw([
				['lineWidth', w], 
				['beginPath'], 
				['moveTo', x, y], 
				['lineTo', x + len, y], 
				['closePath'], 
				['strokeStyle', color], 
				['stroke']
			]);
			// add a "+x%" for extreme cases
			if (long) this.draw([
				['fillStyle', textcolor || '#000'], 
				['fillText', '' + long + '%', x + max - 35, y - 7]
			]);
			// draw highlighted background
			if (highlighted)
				this.draw([
					['beginPath'], 
					['moveTo', x + len + (outside ? width + 5 : 0), y], 
					['lineTo', x + max, y], 
					['closePath'], 
					['strokeStyle', '#333'], 
					['stroke']
				])
			// add the text onto or beside the colored bar
			this.draw([
				['fillStyle', textcolor || (outside ? '#fff' : '#000')], 
				['fillText', text, x + (outside ? len : 0) + this.state.metrics.text.x, y - 7]
			]);
		}


		this.hex = function(x) { return ('0' + x.toString(16)).slice(-2); }
		this.hex_color = function(x) { return x.map(this.hex).join(''); }
		this.color_diff = function(a, b, index, ratio) { return parseInt(a[index] + (b[index] - a[index]) * ratio, 10) || 0; }

		// calculate the color of (index/max)% on a color list
		this.color_map = function(colors, index, max) {
			if (max) index /= max
			if (index < 0) index += 1 // revert colormap for negatives

			// edge cases, string values
			if (index <= 0 || Number.isNaN(index / 1)) return this.hex_color(colors[0])
			if (index >= 1) return this.hex_color(colors.slice(-1)[0])

			// the ratio between two colors
			var step = 1 / (colors.length - 1), ratio = (index % step) / step, i = parseInt(index / step, 10)

			return this.hex_color([0, 1, 2].map(function(a) { return this.color_diff(colors[i], colors[i + 1], a, ratio); }, this))
		}


		// sort by a given index
		this.sort_by = function(list, index) {
			// default is top-down order, negative index reverses this
			var i = Math.abs(index), s = typeof list[0][i] == 'string', dir = index < 0 ? 1 : -1
			// switch to natural order if string elements or the first element (city name)
			if (s || !i) dir = -dir
			var cmp = function(a, b) { return a < b ? -1 : a > b; }
			// city names or even elements ? compare by first element : compare by i-th element
			return list.sort(function(a, b, j) {
				return dir * (!i || a[i] == b[i] ? cmp(a[0], b[0]) : cmp(a[i], b[i]));
			});
		}

		// for merging arrays a and b
		this.merge = function(a, b, index) { return (index = 0) || a.map(function(x) { return x.concat(b[index++]); }); }

		// convert to int, ignore NaN
		this.int = function(x, base) { return parseInt(x, base || 10) || 0; }

		this.debug = function(stuff) { console.log(stuff); }

		document.observe("dom:loaded", function() { window.prices.init(); });

	}

	window.prices = new Prices();

})();
