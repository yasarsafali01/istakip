package services

import (
	"strconv"
	"time"
)

// CalculateSprintDates mirrors frontend/src/utils/sprintUtils.js:
// start = the 1st of the month, end = the month's last working day
// (Saturday/Sunday rolls back to the nearest weekday).
func CalculateSprintDates(year int, month time.Month) (start, end time.Time) {
	start = time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
	end = lastWorkingDay(year, month)
	return start, end
}

func lastWorkingDay(year int, month time.Month) time.Time {
	// Day 0 of next month = last day of this month.
	d := time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC)
	for d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
		d = d.AddDate(0, 0, -1)
	}
	return d
}

var turkishMonthNames = [...]string{
	"Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
	"Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
}

// SprintName mirrors getSprintName: e.g. "Mayıs 2025".
func SprintName(year int, month time.Month) string {
	return turkishMonthNames[month-1] + " " + strconv.Itoa(year)
}
