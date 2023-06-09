import requests
import json
import sys
import calendar
import time

id = sys.argv[1]
balance = sys.argv[2]


current_GMT = time.gmtime()
time_stamp = calendar.timegm(current_GMT)

client = requests.Session()
url = "https://sicapital.ru/accounts/login/"
r = client.get(url, verify=False)

csrf = r.cookies["csrftoken"]

login_data = {
    "username": "sc_common",
    "password": "cakes_are_yummy_omnomnom",
    "csrfmiddlewaretoken": csrf,
}

r1 = client.post(url, data=login_data, headers=dict(Referer=url), verify=False)

session_id = client.cookies["sessionid"]

data = [{"timestamp": time_stamp, "section": id, "balance": balance}]


headers = {
    "Content-Type": "application/json",
    "X-CSRFTOKEN": csrf,
    "Cookie": f"csrftoken={csrf}; sessionid={session_id}",
    "Referer": "https://sicapital.ru/reports/",
}

url = "https://sicapital.ru/states/update_balance/"
response = requests.post(url, data=json.dumps(data), headers=headers, verify=False)