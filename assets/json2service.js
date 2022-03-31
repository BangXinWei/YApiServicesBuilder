const modifier = (s, config) => {
    const target = {};
    Object.keys(s.paths).forEach((pathsItem) => {
        let targetKey = pathsItem;
        if (pathsItem.indexOf("/:") > 0) {
            const temp = pathsItem.split("/");
            let result = temp[0];
            for (let i = 1; i < temp.length; i++) {
                const filterStr =
                    temp[i].indexOf(":") >= 0 ? `{${temp[i].replace(":", "")}}` : temp[i];
                result = `${result}/${filterStr}`;
            }
            targetKey = result;
        }

        target[targetKey] = s.paths[pathsItem];

        Object.keys(target[targetKey]).forEach((method) => {
            const methodInfo = target[targetKey][method];
            methodInfo["parameters"].forEach((targetItem) => {
                if (targetItem["schema"] && targetItem["schema"]["title"] == "title") {
                    delete targetItem["schema"]["title"];
                }
            });

            const targetItem = methodInfo["responses"]["200"];
            if (targetItem["schema"] && targetItem["schema"]["title"] == "title") {
                targetItem["schema"]["title"] =
                    targetKey
                    .replace("{", "")
                    .replace("}", "")
                    .split("/")
                    .slice(1)
                    .filter(tempValueData => tempValueData.length > 0)
                    .map((subItem) => {
                        return subItem[0].toUpperCase() + subItem.substring(1);
                    })
                    .join("") + "Responses";
            }
        });
    });
    s.paths = target;
    return s;
};
module.exports = {
    url: `swagger.json`,
    remoteUrl: `api.json`,
    type: "yapi",
    swaggerParser: {
        "-o": `services`,
        "-t": "./template",
    },
    swaggerConfig: {
        modifier: modifier,
    },
};