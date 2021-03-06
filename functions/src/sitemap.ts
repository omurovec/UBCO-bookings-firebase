import * as https from "https";
import * as config from "./config.json";
import * as qs from "querystring";
import { parse } from "node-html-parser";
import Table from "./Table";

type Session = {
	csrf: string;
	cookie: string[];
};

//Get cookie and csrf token to sign in
const getSession = new Promise(resolve => {
	const options = {
		method: "GET",
		hostname: "bookings.ok.ubc.ca",
		path: "/studyrooms/admin.php",
		headers: {
			...config.headers
		}
	};

	const req = https.request(options, res => {
		let chunks = "";

		res.on("data", (chunk: string) => {
			  chunks += chunk;
		});

    res.on("error", () => {
        throw new Error( "Error connecting to UBCO's servers" );
    })

		res.on("end", () => {
			resolve({
				cookie: res.headers["set-cookie"],
				csrf: (((parse(
					chunks
				) as unknown) as HTMLElement).querySelector(
					`[name="csrf_token"]`
				).attributes as any).content
			});
		});
	});

	req.end();
});

//View booking and return csrf
const getBookingInfo = (session, booking) =>
	new Promise(resolve => {
		const params = {
			id: booking.id,
			area: booking.area,
			day: booking.day,
			month: booking.month,
			year: booking.year
		};

		const options = {
			method: "GET",
			hostname: "bookings.ok.ubc.ca",
			path:
				"/studyrooms/view_entry.php?" +
				qs.stringify(params),
			headers: {
				...config.headers,
				Host: "bookings.ok.ubc.ca",
				Cookie: cookieStripper(session.cookie)
			}
		};

		const req = https.request(options, res => {
			let chunks = "";

			res.on("data", chunk => {
				chunks += chunk;
			});

			res.on("end", () => {
				const body = (parse(
					chunks
				) as unknown) as HTMLElement;
				resolve({
					csrf_token: (body.querySelector(
						`[name="csrf_token"]`
					).attributes as any).content
				});
			});
		});

		req.end();
	});

//Reformat cookie from array of strings to a signle string
const cookieStripper = (cookie: string[]) => {
	let cookieString = "";
	cookie.forEach((item, ind, arr) => {
		cookieString += item.substring(0, item.indexOf(";"));
		if (ind < arr.length - 1) {
			cookieString += "; ";
		}
	});
	return cookieString;
};

//Get booking form info
export const getBookingForm = cookie => {
	return new Promise(resolve => {
		const options = {
			method: "GET",
			hostname: "bookings.ok.ubc.ca",
			path: "/studyrooms/edit_entry.php",
			headers: {
				...config.headers,
				Host: "bookings.ok.ubc.ca",
				Cookie: cookieStripper(cookie)
			}
		};

      //Initialize request to UBCO's site
		const req = https.request(options, res => {
			let chunks = "";

			res.on("data", chunk => {
				chunks += chunk;
			});

			res.on("end", () => {
				const body = (parse(
					chunks
				) as unknown) as HTMLElement;
          //Return form info for creating a booking
				resolve({
					cookie: cookie,
					formData: {
              //<meta name="csrf_token" content="1b7a72065ee234279ada41baf4a04d37afbf7c9c68b1e59faee8fd68282d306b">
						csrf_token: (body.querySelector(
							`[name="csrf_token"]`
						).attributes as any).content,
              //<input type="hidden" name="edit_type" value="series">
						editType: body.querySelector(
							`[name="edit_type"]`
						).attributes["value"],
              //<input type="hidden" name="rep_id" value="0">
						repID: body.querySelector(`[name="rep_id"]`)
							.attributes["value"],
              //<input type="hidden" name="returl" value="https://bookings.ok.ubc.ca/studyrooms/day.php?...">
						returl: body.querySelector(`[name="returl"]`)
							.attributes["value"],
						type: "G" //No option for workshop ("W") on app
					}
				});
			});
		});

		req.end();
	});
};

//Find all areas available to book at UBCO
export const fetchAreas = input => {
  const path = "/studyrooms/day.php?" + qs.stringify(input);
	return new Promise(resolve => {
		const options = {
			method: "GET",
			hostname: "bookings.ok.ubc.ca",
			path: path,
			headers: {
				...config.headers
			}
		};

      //Initialize request to get list of available areas
		https
			.request(options, resp => {
				let data = "";

				resp.on("data", chunk => {
					data += chunk;
				});

				resp.on("end", () => {
					resolve({
            // Return elements in areas list
            // EXAMPLE ELEMENT: <option value="5">Commons: Floor 0</option>
						areas: (((parse(
							data
						) as unknown) as HTMLElement).querySelector(
							"#area_select"
						).childNodes as any)
              // Remove elements without a room ID
						      .filter(( child: {attributes?: {}} ) => child.attributes)
                  .map(( child: {text: string, attributes: {value: string}} ) => ({
                      // name: 'Commons: Floor 0'
                      // id: 5
                        name: child.text,
                        id: child.attributes.value
                    })),
						  path: path,
						...input
					});
				});
			})
			.end();
	});
};

//Get list of current bookings
export const fetchBookings = req => new Promise((_resolve, _reject) => {
      // Fetch all rooms for each area
		const fetchRoom = req.areas.map(area => {
			return new Promise(resolve => {
				const options = {
					method: "GET",
					hostname: "bookings.ok.ubc.ca",
					path: req.path + "&area=" + area.id,
					headers: {
						...config.headers
					}
				};
				https
					.request(options, resp => {
						let data = "";
						resp.on("data", chunk => {
							data += chunk;
						});
						resp.on("end", () => {
                // Resolve promise with area info and html table schedule
							resolve({
								area: area,
								html: ((parse(
									data
								) as unknown) as HTMLElement).querySelector(
									"#day_main"
								)
							});
						});
					})
					.end();
			});
		});

		// Trigger all promises and parse data from each html table
		Promise.all(fetchRoom)
			.then(areas =>
				areas.map(
					(area: { html: HTMLElement; area: any }) => {
              // Create Table object with the html table
						const table = new Table(area.html);
              // Return area and available slots
						return {
							...area.area,
							slots: table.getSlots(Number(req.time))
						};
					}
				)
			)
			.then(res => {
				_resolve(res);
			})
			.catch(err => {
				_reject(err);
			});
	});

//Login with Novell credentials and return session cookie
export const login = acc => {
	return new Promise(async resolve => {
      //Retrieve session for login
		const session = (await getSession) as Session;

		const options = {
			method: "POST",
			hostname: "bookings.ok.ubc.ca",
			path: "/studyrooms/admin.php",
			headers: {
				...config.headers,
				"Content-Type": "application/x-www-form-urlencoded",
				Cookie: cookieStripper(session.cookie),
				Referer:
					"https://bookings.ok.ubc.ca/studyrooms/admin.php?"
			}
		};

      //Initialize request to UBCO bookings site login
		const req = https.request(options, res => {
			let chunks = "";

			res.on("data", chunk => {
				chunks += chunk;
			});

			res.on("end", () => {
          //Check for #show_my_entries element which is only returned if logged in
				const validCredentials = ((parse(
					chunks
				) as unknown) as HTMLElement).querySelector(
					"#show_my_entries"
				);
          //Return result with cookie and csrf for further actions on the UBCO site
				resolve({
					success: validCredentials ? true : false,
					cookie: res.headers["set-cookie"],
					csrf: session.csrf
				});
			});
		});

      //Fill out log in form with csrf from session and username/password
		req.write(
			qs.stringify({
				action: "SetName",
				csrf_token: session.csrf,
				password: acc.password,
				returl:
					"https://bookings.ok.ubc.ca/studyrooms/admin.php?area=1&room=1&hour=11&minute=30&year=2019&month=7&day=9",
				target_url: "admin.php?",
				username: acc.username
			})
		);

		req.end();
	});
};

//Post booking to UBCO site
export const postBooking = (request, session, form) =>
	new Promise(resolve => {
		const options = {
			method: "POST",
			hostname: "bookings.ok.ubc.ca",
			path: "/studyrooms/edit_entry_handler.php",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				...config.headers,
				Cookie: cookieStripper(session.cookie),
				Referer:
					"https://bookings.ok.ubc.ca/studyrooms/edit_entry_handler.php"
			}
		};

      //Initialize request to UBCO's site
		const req = https.request(options, res => {
			let chunks = "";

			res.on("data", chunk => {
				chunks += chunk;
			});

			res.on("end", () => {
				resolve({
            // If the request is successful, the html will have an H1 element
            // Return { success: true } if the H1 element is found
					success:
						((parse(
							chunks
						) as unknown) as HTMLElement).querySelector(
							"h1"
						) === null
				});
			});
		});

      // Map request to UBCO's booking form
		req.write(
			qs.stringify({
				area: request.area,
				create_by: request.username,
				csrf_token: form.csrf_token,
				description: request.description,
				edit_type: form.editType,
				end_day: request.day,
				end_month: request.month,
				end_seconds: request.endTime * 3600,
				end_year: request.year,
				f_email: request.email,
				f_phone: request.phone,
				name: request.title,
				rep_id: form.repID,
				returl: form.returl,
				"rooms[]": request.roomID,
				start_day: request.day,
				start_month: request.month,
				start_seconds: request.startTime * 3600,
				start_year: request.year,
				type: form.type
			})
		);

		req.end();
	});

//Cancel booking from UBCO site
export const deleteBooking = (session, booking) =>
	new Promise(async resolve => {
		const csrf_token = (await getBookingInfo(
			session,
			booking
		)) as any;

		const options = {
			method: "POST",
			hostname: "bookings.ok.ubc.ca",
			path: "/studyrooms/del_entry.php",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				...config.headers,
				Cookie: cookieStripper(session.cookie),
				Referer:
					"https://bookings.ok.ubc.ca/studyrooms/edit_entry_handler.php"
			}
		};

      //Initialize request tp UBCO's site
		const req = https.request(options, res => {
			res.on("data", () => {
				return null;
			});

			res.on("end", () => {
				resolve({
					success: true
				});
			});
		});

      // Map request to UBCO's 'delete booking' form
		req.write(
			qs.stringify({
				...csrf_token,
				id: booking.id,
				series: 0
			})
		);

		req.end();
	});

export const fetchBooked = request =>
	new Promise(resolve => {
		const options = {
			method: "POST",
			hostname: "bookings.ok.ubc.ca",
			path: "/studyrooms/report.php",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				...config.headers,
				Cookie: cookieStripper(request.cookie)
			}
		};

      //Initialize request to UBCO to retrieve user's bookings
		const req = https.request(options, resp => {
			let data = "";
			resp.on("data", chunk => {
				data += chunk;
			});

			resp.on("end", () => {
				resolve({
					success: true,
					data: JSON.parse(data).aaData.map(booking => {
						const aElem = ((parse(
							booking[0]
						) as unknown) as HTMLElement).querySelector(
							"a"
						);
						const startTimeDate = booking[3].substring(
							booking[3].indexOf("</span>") + 7
						);
						return {
							id: aElem.attributes["data-id"],
							title: aElem.attributes["title"],
							startTime: startTimeDate.substring(
								0,
								startTimeDate.indexOf(" -")
							),
							date: startTimeDate.substring(
								startTimeDate.indexOf("-") + 2
							),
							span:
								(((parse(
									booking[5]
								) as unknown) as HTMLElement).querySelector(
									"span"
								).attributes as any).title / 3600,
							areaName: booking[1],
							roomName: booking[2],
							description: booking[6]
						};
					})
				});
			});
		});

      //Fill form with date from request
		req.write(
			qs.stringify({
				ajax: 1,
				areamatch: "",
				creatormatch: "",
				csrf_token: request.csrf,
				datatable: 1,
				descrmatch: "",
				match_confirmed: 2,
				match_email: "",
				match_phone: "",
				match_private: 2,
				namematch: "",
				output: 0,
				output_format: 0,
				phase: 2,
				roommatch: "",
				sortby: "r",
				from_day: request.day,
				from_month: request.month,
				from_year: request.year,
				to_day: request.day,
				// tslint:disable-next-line: triple-equals
				to_month:
					request.month === 12 ? 1 : request.month + 1,
				// tslint:disable-next-line: triple-equals
				to_year:
					request.month === 12
						? request.year + 1
						: request.year
			})
		);

		req.end();
	});


