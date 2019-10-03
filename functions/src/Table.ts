interface slotNode {
	free: boolean;
	bookingID?: String;
}

interface slot {
	name: string;
	id: number;
	maxSpan: number;
}

interface header {
	name: string;
	id: string;
}

export default class Table {
	rooms: header[];
	data: slotNode[][];
	timeMap: number[];

	//Convert HTML table to 2d array
	constructor(html) {
		this.rooms = html
			.querySelectorAll("th")
			.filter(
				headerElement => headerElement.childNodes.length > 1
			)
			.map(data => ({
				name: data.querySelector("a").text,
				id: data.attributes["data-room"]
			}));

		this.data = [];
		this.timeMap = [];
		const rows = html
			.querySelectorAll("tr")
			.filter(row => row.parentNode.tagName !== "thead");

		for (const row of rows) {
			this.data.push([]);
			const time =
				row.querySelector("td").attributes["data-seconds"] /
				3600;
			this.timeMap.push(time);
		}

		rows.map((row, rowInd) => {
			row
				.querySelectorAll("td")
				.filter(
					element =>
						!element.classNames.includes("row_labels")
				)
				.map((data, colInd) => {
					let offset = 0;
					while (this.data[rowInd][colInd + offset]) {
						offset++;
					}
					if (data.classNames.includes("new")) {
						this.data[rowInd][colInd + offset] = {
							free: true
						};
					} else {
						let length = data.attributes["rowspan"];
						if (!length) {
							length = 1;
						}
						for (let i = 0; i < length; i++) {
							this.data[rowInd + i][colInd + offset] = {
								free: false,
								bookingID: data.querySelector("div")
									.attributes["data-id"]
							};
						}
					}
				});
		});
	}

	//Return all the slots at a given time
	getSlots(time: number): slot[] {
		const slots = [];
		const row = this.timeMap.indexOf(time);
		try {
			for (
				let col = 0;
				col < this.data[row].length;
				col++
			) {
				if (this.data[row][col].free === true) {
					let maxSpan = 1;
					for (let span = 1; span < 4; span++) {
						if (this.data[row + span][col].free === true) {
							maxSpan++;
						}
					}
					slots.push({
						name: this.rooms[col].name,
						id: this.rooms[col].id,
						maxSpan
					});
				}
			}
		} catch (err) {
			return null;
		}
		return slots;
	}

	//Get the ID of a booking at a given time
	getID(roomID: string, time: number) {
		let col: number;
		for (let i = 0; i < this.rooms.length; i++) {
			if (Number(this.rooms[i].id) === Number(roomID)) {
				col = i;
				break;
			}
		}
		return this.data[this.timeMap.indexOf(time)][col]
			.bookingID;
	}

	printTable() {
		// tslint:disable-next-line: prefer-for-of
		for (let x = 0; x < this.data.length; x++) {
			let row = "";
			// tslint:disable-next-line: prefer-for-of
			for (let y = 0; y < this.data[x].length; y++) {
				if (this.data[x][y]) {
					if (this.data[x][y].free === true) {
						row += 0;
					} else if (this.data[x][y].free === false) {
						row += 1;
					}
				} else {
					row += "-";
				}
			}
			console.log(row);
		}
	}
}
