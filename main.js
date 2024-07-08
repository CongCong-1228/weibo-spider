const rejectData = () => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve({ ok: 2 })
        }, 2000)
    })
}

const sleep = () => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve()
        }, 1000)
    })
}

const fetchData = async () => {
    let max_count = 0
    while (max_count < 5) {
        try {
            const data = await rejectData()
            if (data.ok !== 1) {
                throw new Error(JSON.stringify(data.ok))
            }
        } catch (error) {
            max_count ++
            console.error(`请求失败-----失败原因：${JSON.stringify(error.message)}，正在重新请求------第${max_count}次`)
            if (max_count === 5) {
                console.error(`请求次数达到上限5次`)
                return
            }
            await sleep()
        }
    }
}

fetchData()
