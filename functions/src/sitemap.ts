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
            path: "/studyrooms/view_entry.php?" + qs.stringify(params),
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
                const body = (parse(chunks) as unknown) as HTMLElement;
                resolve({
                    csrf_token: (body.querySelector(`[name="csrf_token"]`)
                        .attributes as any).content
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

        const req = https.request(options, res => {
            let chunks = "";

            res.on("data", chunk => {
                chunks += chunk;
            });

            res.on("end", () => {
                const body = (parse(chunks) as unknown) as HTMLElement;
                resolve({
                    cookie: cookie,
                    formData: {
                        csrf_token: (body.querySelector(`[name="csrf_token"]`)
                            .attributes as any).content,
                        editType: body.querySelector(`[name="edit_type"]`)
                            .attributes["value"],
                        repID: body.querySelector(`[name="rep_id"]`).attributes[
                            "value"
                        ],
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

//Find all areas to book at UBCO
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

        https
            .request(options, resp => {
                let data = "";

                resp.on("data", chunk => {
                    data += chunk;
                });

                resp.on("end", () => {
                    resolve({
                        areas: (((parse(
                            data
                        ) as unknown) as HTMLElement).querySelector(
                            "#area_select"
                        ).childNodes as any)
                            .filter(child => child.attributes)
                            .map(child => {
                                return {
                                    name: child.text,
                                    id: child.attributes.value
                                };
                            }),
                        path: path,
                        ...input
                    });
                });
            })
            .end();
    });
};

//Get list of current bookings
export const fetchBookings = req => {
    return new Promise((_resolve, _reject) => {
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

        //Fetch all areas and parse data from the tables
        Promise.all(fetchRoom)
            .then(areas =>
                areas.map((area: { html: HTMLElement; area: any }) => {
                    const table = new Table(area.html);
                    return {
                        ...area.area,
                        slots: table.getSlots(
                            typeof req.time === "number"
                                ? req.time
                                : Number(req.time)
                        )
                    };
                })
            )
            .then(res => {
                _resolve(res);
            })
            .catch(err => {
                _reject(err);
            });
    });
};

//Login with Novell credentials and return session cookie
export const login = acc => {
    return new Promise(async resolve => {
        const session = (await getSession) as Session;

        const options = {
            method: "POST",
            hostname: "bookings.ok.ubc.ca",
            path: "/studyrooms/admin.php",
            headers: {
                ...config.headers,
                "Content-Type": "application/x-www-form-urlencoded",
                Cookie: cookieStripper(session.cookie),
                Referer: "https://bookings.ok.ubc.ca/studyrooms/admin.php?"
            }
        };

        const req = https.request(options, res => {
            res.on("data", chunk => {
                return null;
            });

            res.on("end", () => {
                resolve({
                    success: res.headers.location !== null,
                    cookie: res.headers["set-cookie"]
                });
            });
        });

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
        resolve();
        const options = {
            method: "POST",
            hostname: "bookings.ok.ubc.ca",
            path: "/studyrooms/edit_entry_handler.php",
            headers: {
                ...config.headers,
                Cookie: cookieStripper(session.cookie),
                Referer:
                    "https://bookings.ok.ubc.ca/studyrooms/edit_entry_handler.php"
            }
        };

        const req = https.request(options, res => {
            let chunks = "";

            res.on("data", chunk => {
                chunks += chunk;
            });

            res.on("end", () => {
                resolve({
                    headers: res.headers,
                    body: chunks
                });
            });
        });

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
        const csrf_token = (await getBookingInfo(session, booking)) as any;

        const options = {
            method: "POST",
            hostname: "bookings.ok.ubc.ca",
            path: "/studyrooms/edit_entry_handler.php",
            headers: {
                ...config.headers,
                Cookie: cookieStripper(session.cookie),
                Referer:
                    "https://bookings.ok.ubc.ca/studyrooms/edit_entry_handler.php"
            }
        };

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

        req.write(
            qs.stringify({
                ...csrf_token,
                id: booking.id,
                series: 0
            })
        );

        req.end();
    });

//Fetch the booking ID from UBCO site
export const getBookingID = booking =>
    new Promise(resolve => {
        const options = {
            method: "GET",
            hostname: "bookings.ok.ubc.ca",
            path:
                "/studyrooms/day.php?" +
                qs.stringify({
                    year: booking.year,
                    month: booking.month,
                    day: booking.day,
                    area: booking.area
                }),
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
                    const table = new Table(
                        ((parse(data) as unknown) as HTMLElement).querySelector(
                            "#day_main"
                        )
                    );
                    resolve(
                        table.getID(booking.roomID, Number(booking.startTime))
                    );
                });
            })
            .end();
    });