package com.psap.palletisation.repository;

import com.psap.palletisation.entity.IntegrationResultBoxEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

public interface IntegrationResultBoxRepository extends JpaRepository<IntegrationResultBoxEntity, Long> {
    List<IntegrationResultBoxEntity> findByOrderId(String orderId);

    @Transactional
    void deleteByOrderId(String orderId);
}
