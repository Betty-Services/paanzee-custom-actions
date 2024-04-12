const calculateWeatherGrade = async ({ startTime, endTime }) => {
    // MB => MeteoBlue
    // ACW => AccuWeather
    //////////////////////////
    //// Helper Functions ////
    //////////////////////////
    const summarizeWeatherData = (weatherData, type) => {
        let maxTemp = 0;
        let hoursRain = 0;
        let hoursWind = 0;
        let avgWinddir = 0;
        let avgWind = 0;
        let totalMinutesSunshine = 0;
        let hoursClouds = 0;
        for (let i = 0; i < weatherData.length; i++) {
            if (weatherData[i].temperature > maxTemp) {
                maxTemp = weatherData[i].temperature;
            }
            if (weatherData[i].precipitation >= 0.2) {
                hoursRain++;
            }
            if (weatherData[i].windspeed > 5.5) {
                hoursWind++;
            }
            if (weatherData[i].cloudcover > 50) {
                hoursClouds++;
            }
            totalMinutesSunshine += weatherData[i].sunshinetime;
            avgWind += weatherData[i].windspeed;
            avgWinddir += weatherData[i].winddir;
        }
        const result = {
            maxTemp,
            hoursRain,
            hoursWind,
            avgWindSpeed: avgWind / weatherData.length,
            avgWinddir: avgWinddir / weatherData.length,
        };
        if (type === "MB") {
            result.totalMinutesSunshine = totalMinutesSunshine;
        }
        else {
            result.hoursClouds = hoursClouds;
        }
        return result;
    };
    const calculateTemperatureGrade = (maxTemp, totalMinutesSunshine, type = "ACW") => {
        let result = 6;
        // If type is MB (MeteoBlue) then use different calculation method for sunshine time
        if (type == "MB") {
            if (maxTemp > 20 && totalMinutesSunshine > 660) {
                result = 10;
            }
            else if ((maxTemp > 15 && totalMinutesSunshine > 660) || maxTemp > 20) {
                result = 9;
            }
            else if (maxTemp > 18 && totalMinutesSunshine > 540) {
                result = 8;
            }
            else if ((maxTemp > 18 && totalMinutesSunshine > 480) || (maxTemp > 14)) {
                result = 7;
            }
        }
        else {
            // The results from AccuWeather don't have sunshine time
            if (maxTemp > 21) {
                result = 10;
            }
            else if (maxTemp > 20) {
                result = 9;
            }
            else if (maxTemp > 19) {
                result = 8;
            }
            else if (maxTemp > 18) {
                result = 7;
            }
        }
        return result;
    };
    const calculateRainPenalty = (hoursRain) => {
        let rainPenalty = 0;
        if (hoursRain > 5) {
            rainPenalty = 5;
        }
        else if (hoursRain > 4) {
            rainPenalty = 4;
        }
        else if (hoursRain > 3) {
            rainPenalty = 3;
        }
        else if (hoursRain > 2) {
            rainPenalty = 2;
        }
        else if (hoursRain > 1) {
            rainPenalty = 1;
        }
        return rainPenalty;
    };
    const calculateCloudPenalty = (hoursClouds) => {
        let result = 0;
        if (hoursClouds > 5) {
            result = 2;
        }
        else if (hoursClouds > 2) {
            result = 1;
        }
        return result;
    };
    const calculateWindPenalty = (hoursWind) => {
        let windPenalty = 0;
        if (hoursWind > 3) {
            windPenalty = 1;
        }
        return windPenalty;
    };
    const calculateWindCorrection = (windPenalty, avgWinddir, avgWindSpeed) => {
        let windCorrection = 0;
        if (windPenalty === 1 && avgWinddir > 45 && avgWinddir < 135 && avgWindSpeed < 9) {
            windCorrection = 1;
        }
        return windCorrection;
    };
    const calculateWeatherGrade = (weatherData, type = "MB") => {
        // The type is used to define the calculation method for sunshine time
        let result = 0;
        const temperatureGrade = calculateTemperatureGrade(weatherData.maxTemp, weatherData.totalMinutesSunshine, type);
        const rainPenalty = calculateRainPenalty(weatherData.hoursRain);
        const penaltyClouds = type === "ACW" ? calculateCloudPenalty(5) : 0;
        const windPenalty = calculateWindPenalty(weatherData.hoursWind);
        const windCorrection = calculateWindCorrection(windPenalty, weatherData.avgWinddir, weatherData.avgWindSpeed);
        result = temperatureGrade - rainPenalty - penaltyClouds - windPenalty + windCorrection;
        // If result below 1 then set to 1 if result above 10 then set to 10
        if (result < 1) {
            result = 1;
        }
        else if (result > 10) {
            result = 10;
        }
        return result;
    };
    /////////////////////////
    ///// MeteoBlue API /////
    /////////////////////////
    const constructMBAPIURL = (api_key, lat, lon) => {
        return `https://my.meteoblue.com/packages/basic-1h_clouds-1h?apikey=${api_key}&lat=${lat}&lon=${lon}&asl=9&format=json&forecast_days=1`;
    };
    const fetchMBWeatherData = async (url) => {
        console.info("Connecting to METEOBLUE API at: ", url);
        try {
            const result = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                },
                body: null
            });
            if (!result.ok) {
                throw new Error("An error occurred trying to connect to the MeteoBlue API");
            }
            const response = await result.json();
            if (response)
                return response;
        }
        catch (error) {
            console.error("An error occurred");
        }
    };
    const constructTime = (time) => {
        const date = new Date();
        date.setHours(Number(time.split(":")[0]));
        date.setMinutes(Number(time.split(":")[1]));
        date.setSeconds(0);
        date.setMilliseconds(0);
        return date;
    };
    const convertMBWeatherData = (weatherData, start_time, end_time) => {
        const jsonData = [];
        // Construct start time with today's date
        const start = constructTime(start_time);
        const end = constructTime(end_time);
        for (let i = 0; i < weatherData.data_1h.time.length; i++) {
            const datetime = new Date(weatherData.data_1h.time[i]);
            if (datetime < start) {
                // Go to next iteration
                continue;
            }
            else if (datetime > end) {
                // Go to next iteration
                continue;
            }
            const item = {};
            item.datetime = weatherData.data_1h.time[i];
            item.temperature = weatherData.data_1h.temperature[i];
            item.precipitation = weatherData.data_1h.precipitation[i];
            item.windspeed = weatherData.data_1h.windspeed[i];
            item.winddir = weatherData.data_1h.winddirection[i];
            item.sunshinetime = weatherData.data_1h.sunshinetime[i];
            jsonData.push(item);
        }
        return jsonData;
    };
    const getMBWeatherGrade = async (startTime = "08:00", endTime = "18:00") => {
        const LAT = "52.5567";
        const LON = "4.60972";
        const API_KEY_MB = 'Qj4Px5ubnDOzG9Sa';
        // MeteoBlue API
        const MB_API_URL = constructMBAPIURL(API_KEY_MB, LAT, LON);
        const MBResult = await fetchMBWeatherData(MB_API_URL);
        const MBWeatherData = convertMBWeatherData(MBResult, startTime, endTime);
        const MBSummary = summarizeWeatherData(MBWeatherData, "MB");
        console.log('MB Summary: ', MBSummary);
        const MBGrade = calculateWeatherGrade(MBSummary, "MB");
        return MBGrade;
    };
    /////////////////////////
    //// AccuWeather API ////
    /////////////////////////
    const constructACWAPIURL = (api_key, location_key) => {
        return `http://dataservice.accuweather.com/forecasts/v1/hourly/12hour/${location_key}?apikey=${api_key}&language=en-us&details=true&metric=true`;
    };
    const fetchACWWeatherData = async (url) => {
        console.info("Connecting to AccuWeather API at: ", url);
        try {
            const result = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                },
                body: null
            });
            if (!result.ok) {
                throw new Error("An error occurred trying to connect to the AccuWeather API");
            }
            const response = await result.json();
            if (response)
                return response;
        }
        catch (error) {
            console.error("An error occurred");
        }
    };
    const convertACWWeatherData = (weatherData, start_time, end_time) => {
        const jsonData = [];
        // Construct start time with today's date
        const start = constructTime(start_time);
        const end = constructTime(end_time);
        for (var i = 0; i < weatherData.length; i++) {
            const datetime = new Date(weatherData[i].DateTime);
            if (datetime < start) {
                // Go to next iteration
                continue;
            }
            else if (datetime > end) {
                // Go to next iteration
                continue;
            }
            const item = {
                datetime: weatherData[i].DateTime,
                temperature: weatherData[i].Temperature.Value,
                precipitation: weatherData[i].Rain.Value,
                windspeed: weatherData[i].Wind.Speed.Value / 3.6,
                winddir: weatherData[i].Wind.Direction.Degrees,
                cloudcover: weatherData[i].CloudCover
            };
            jsonData.push(item);
        }
        return jsonData;
    };
    const getACWWeatherGrade = async (startTime = "08:00", endTime = "18:00") => {
        const API_KEY_ACW = 'BMblIjRvIioBq08el96rqYTNJXAKgWrz';
        const ACW_LOCATION_KEY = '249627';
        const ACW_API_URL = constructACWAPIURL(API_KEY_ACW, ACW_LOCATION_KEY);
        const ACWResult = await fetchACWWeatherData(ACW_API_URL);
        const ACWWeatherData = convertACWWeatherData(ACWResult, startTime, endTime);
        console.log('ACW Weather Data: ', ACWWeatherData);
        const ACWSummary = summarizeWeatherData(ACWWeatherData, "ACW");
        console.log('ACW Summary: ', ACWSummary);
        const ACWGrade = calculateWeatherGrade(ACWSummary, "ACW");
        return ACWGrade;
    };
    // const acwWeatherGrade = getACWWeatherGrade(startTime, endTime);
    const mbWeatherGrade = getMBWeatherGrade(startTime, endTime);
    // const grades = await Promise.all([acwWeatherGrade, mbWeatherGrade]);
    // const averageGrade = (grades[0] + grades[1]) / 2;
    return {
        result: mbWeatherGrade
    };
};
export default calculateWeatherGrade;
